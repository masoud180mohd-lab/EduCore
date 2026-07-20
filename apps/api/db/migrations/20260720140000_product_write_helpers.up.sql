-- IMP-001 P14/P15: SECURITY DEFINER product write helpers for educore_app.
-- Nest runtime stays on educore_app; table INSERT/UPDATE remain revoked where already locked.
-- AuthZ (permission + session bind) is enforced in Nest; helpers re-check active membership.

-- ---------------------------------------------------------------------------
-- W1: replace tenant settings document (UPSERT)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.replace_tenant_settings(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_schema_version integer,
  p_settings jsonb
)
RETURNS TABLE (
  schema_version integer,
  settings jsonb,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF p_schema_version IS NULL OR p_schema_version < 1 THEN
    RAISE EXCEPTION 'schema_version must be >= 1' USING ERRCODE = '22023';
  END IF;
  IF p_settings IS NULL OR jsonb_typeof(p_settings) <> 'object' THEN
    RAISE EXCEPTION 'settings must be a json object' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;

  INSERT INTO tenant_settings (
    tenant_id, schema_version, settings, updated_at, updated_by_user_id
  ) VALUES (
    p_tenant_id, p_schema_version, p_settings, now(), p_actor_user_id
  )
  ON CONFLICT (tenant_id) DO UPDATE
    SET schema_version = EXCLUDED.schema_version,
        settings = EXCLUDED.settings,
        updated_at = now(),
        updated_by_user_id = EXCLUDED.updated_by_user_id;

  RETURN QUERY
  SELECT s.schema_version, s.settings, s.updated_at
  FROM tenant_settings s
  WHERE s.tenant_id = p_tenant_id;
END;
$$;

COMMENT ON FUNCTION app.replace_tenant_settings(uuid, uuid, integer, jsonb) IS
  'P14: UPSERT tenant_settings for bound tenant. SECURITY DEFINER; requires active membership.';

-- ---------------------------------------------------------------------------
-- W2: invite / create membership by email (find-or-create user)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.invite_tenant_membership(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_membership_id uuid,
  p_new_user_id uuid,
  p_email citext,
  p_display_name text
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  user_id uuid,
  status text,
  joined_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  v_user_id uuid;
  v_display text;
  v_existing_membership tenant_memberships%ROWTYPE;
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL
     OR p_membership_id IS NULL OR p_new_user_id IS NULL
     OR p_email IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;

  v_display := NULLIF(btrim(COALESCE(p_display_name, '')), '');
  IF v_display IS NULL THEN
    v_display := split_part(p_email::text, '@', 1);
  END IF;
  IF char_length(v_display) < 1 OR char_length(v_display) > 200 THEN
    RAISE EXCEPTION 'invalid display_name' USING ERRCODE = '22023';
  END IF;

  SELECT u.id INTO v_user_id
  FROM users u
  WHERE u.email = p_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    INSERT INTO users (
      id, email, email_verified_at, display_name, status, password_hash,
      external_subject_id, last_login_at, created_at, updated_at
    ) VALUES (
      p_new_user_id, p_email, NULL, v_display, 'invited', NULL,
      NULL, NULL, now(), now()
    );
    v_user_id := p_new_user_id;
  END IF;

  SELECT * INTO v_existing_membership
  FROM tenant_memberships m
  WHERE m.tenant_id = p_tenant_id
    AND m.user_id = v_user_id
  LIMIT 1;

  IF FOUND THEN
    IF v_existing_membership.status IN ('active', 'invited') THEN
      RAISE EXCEPTION 'membership already exists'
        USING ERRCODE = '23505',
              DETAIL = 'conflict';
    END IF;
    -- Reactivate removed/suspended as invited invite path (no separate reactivate route).
    UPDATE tenant_memberships
    SET status = 'invited',
        joined_at = NULL,
        updated_at = now()
    WHERE id = v_existing_membership.id;

    RETURN QUERY
    SELECT m.id, m.tenant_id, m.user_id, m.status, m.joined_at, m.created_at, m.updated_at
    FROM tenant_memberships m
    WHERE m.id = v_existing_membership.id;
    RETURN;
  END IF;

  INSERT INTO tenant_memberships (
    id, tenant_id, user_id, status, joined_at, created_at, updated_at
  ) VALUES (
    p_membership_id, p_tenant_id, v_user_id, 'invited', NULL, now(), now()
  );

  RETURN QUERY
  SELECT m.id, m.tenant_id, m.user_id, m.status, m.joined_at, m.created_at, m.updated_at
  FROM tenant_memberships m
  WHERE m.id = p_membership_id;
END;
$$;

COMMENT ON FUNCTION app.invite_tenant_membership(uuid, uuid, uuid, uuid, citext, text) IS
  'P15: Find-or-create user + invited membership. SECURITY DEFINER; active membership required. 23505 on duplicate active/invited.';

-- ---------------------------------------------------------------------------
-- Optional: assign system role codes after invite (same SECURITY DEFINER)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.assign_system_role_codes(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_target_user_id uuid,
  p_role_codes text[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  v_code text;
  v_role_id uuid;
  v_assigned integer := 0;
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;
  IF p_role_codes IS NULL OR cardinality(p_role_codes) = 0 THEN
    RETURN 0;
  END IF;

  FOREACH v_code IN ARRAY p_role_codes
  LOOP
    IF v_code IS NULL OR btrim(v_code) = '' THEN
      CONTINUE;
    END IF;
    -- Only system roles (not custom); invite must not escalate via unknown codes.
    IF v_code NOT IN ('owner', 'admin', 'staff') THEN
      RAISE EXCEPTION 'invalid role code: %', v_code USING ERRCODE = '22023';
    END IF;

    SELECT r.id INTO v_role_id
    FROM roles r
    WHERE r.tenant_id = p_tenant_id
      AND r.code = v_code
      AND r.is_system = true
    LIMIT 1;

    IF v_role_id IS NULL THEN
      RAISE EXCEPTION 'system role not found for tenant: %', v_code USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO user_roles (id, tenant_id, user_id, role_id, created_at)
    VALUES (gen_random_uuid(), p_tenant_id, p_target_user_id, v_role_id, now())
    ON CONFLICT DO NOTHING;

    v_assigned := v_assigned + 1;
  END LOOP;

  RETURN v_assigned;
END;
$$;

COMMENT ON FUNCTION app.assign_system_role_codes(uuid, uuid, uuid, text[]) IS
  'P15: Assign system role codes to invitee. SECURITY DEFINER; educore_app has no direct RBAC writes.';

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT EXECUTE ON FUNCTION app.replace_tenant_settings(uuid, uuid, integer, jsonb) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.invite_tenant_membership(uuid, uuid, uuid, uuid, citext, text) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.assign_system_role_codes(uuid, uuid, uuid, text[]) TO educore_app;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION app.replace_tenant_settings(uuid, uuid, integer, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.invite_tenant_membership(uuid, uuid, uuid, uuid, citext, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.assign_system_role_codes(uuid, uuid, uuid, text[]) FROM PUBLIC;
