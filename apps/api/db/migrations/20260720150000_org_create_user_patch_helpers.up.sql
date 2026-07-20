-- IMP-001 P16/P17: SECURITY DEFINER product write helpers for organizations create + user displayName patch.
-- Nest stays on educore_app. AuthZ remains in Nest; helpers re-check membership/visibility.

-- ---------------------------------------------------------------------------
-- W3: create organization in bound tenant
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.create_organization(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_org_id uuid,
  p_org_type text,
  p_name text,
  p_code text,
  p_parent_organization_id uuid
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  org_type text,
  name text,
  code text,
  status text,
  parent_organization_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_org_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF p_org_type IS NULL OR p_org_type NOT IN ('school', 'campus', 'department') THEN
    RAISE EXCEPTION 'invalid org_type' USING ERRCODE = '22023';
  END IF;
  IF p_name IS NULL OR char_length(btrim(p_name)) < 1 OR char_length(btrim(p_name)) > 200 THEN
    RAISE EXCEPTION 'invalid name' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;

  IF p_parent_organization_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM organizations p
      WHERE p.id = p_parent_organization_id
        AND p.tenant_id = p_tenant_id
    ) THEN
      RAISE EXCEPTION 'parent organization not found' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  INSERT INTO organizations (
    id, tenant_id, org_type, name, code, status, parent_organization_id, created_at, updated_at
  ) VALUES (
    p_org_id,
    p_tenant_id,
    p_org_type,
    btrim(p_name),
    NULLIF(btrim(COALESCE(p_code, '')), ''),
    'active',
    p_parent_organization_id,
    now(),
    now()
  );

  RETURN QUERY
  SELECT o.id, o.tenant_id, o.org_type, o.name, o.code, o.status,
         o.parent_organization_id, o.created_at, o.updated_at
  FROM organizations o
  WHERE o.id = p_org_id;
END;
$$;

COMMENT ON FUNCTION app.create_organization(uuid, uuid, uuid, text, text, text, uuid) IS
  'P16: Insert organization in bound tenant. SECURITY DEFINER; active membership required.';

-- ---------------------------------------------------------------------------
-- W4: update display_name for user visible in tenant (active membership)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.update_user_display_name(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_target_user_id uuid,
  p_display_name text
)
RETURNS TABLE (
  id uuid,
  email citext,
  display_name text,
  status text,
  email_verified_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF p_display_name IS NULL
     OR char_length(btrim(p_display_name)) < 1
     OR char_length(btrim(p_display_name)) > 120 THEN
    RAISE EXCEPTION 'invalid display_name' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;
  -- Visibility: target must have active membership in bound tenant (same as GET detail default).
  IF NOT EXISTS (
    SELECT 1
    FROM tenant_memberships m
    WHERE m.user_id = p_target_user_id
      AND m.tenant_id = p_tenant_id
      AND m.status = 'active'
  ) THEN
    RETURN; -- empty result → app maps to 404
  END IF;

  UPDATE users u
  SET display_name = btrim(p_display_name),
      updated_at = now()
  WHERE u.id = p_target_user_id;

  RETURN QUERY
  SELECT u.id, u.email, u.display_name, u.status,
         u.email_verified_at, u.last_login_at, u.created_at, u.updated_at
  FROM users u
  WHERE u.id = p_target_user_id;
END;
$$;

COMMENT ON FUNCTION app.update_user_display_name(uuid, uuid, uuid, text) IS
  'P17: Update display_name for active member of bound tenant. SECURITY DEFINER; AuthZ manage-or-self in Nest.';

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT EXECUTE ON FUNCTION app.create_organization(uuid, uuid, uuid, text, text, text, uuid) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.update_user_display_name(uuid, uuid, uuid, text) TO educore_app;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION app.create_organization(uuid, uuid, uuid, text, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.update_user_display_name(uuid, uuid, uuid, text) FROM PUBLIC;
