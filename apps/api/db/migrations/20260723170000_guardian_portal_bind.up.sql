-- IMP-011-PX / DBF-011: guardian↔user portal bind + parent system role + scoped permissions.

ALTER TABLE guardians
  ADD COLUMN IF NOT EXISTS user_id uuid NULL REFERENCES users (id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_guardians_tenant_user_id
  ON guardians (tenant_id, user_id)
  WHERE user_id IS NOT NULL;

COMMENT ON COLUMN guardians.user_id IS
  'DBF-011: optional portal bind to users.id (one guardian per user per tenant).';

-- Permissions (global catalogue)
INSERT INTO permissions (id, code, description) VALUES
  ('01900000-0001-7000-8000-000000000050', 'parent.guardian.read', 'Read own bound guardian and student links'),
  ('01900000-0001-7000-8000-000000000051', 'parent.finance.read', 'Read invoices/payments/receipts for linked students only')
ON CONFLICT (code) DO NOTHING;

-- Ensure parent system role exists for every tenant
INSERT INTO roles (id, tenant_id, code, name, is_system, created_at, updated_at)
SELECT gen_random_uuid(), t.id, 'parent', 'Parent', true, now(), now()
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM roles r WHERE r.tenant_id = t.id AND r.code = 'parent'
);

-- Grant parent.* to parent role; also catalogue onto owner/admin (full catalogue posture)
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, now()
FROM roles r
CROSS JOIN permissions p
WHERE r.is_system = true
  AND (
    (r.code = 'parent' AND p.code IN ('parent.guardian.read', 'parent.finance.read'))
    OR (r.code IN ('owner', 'admin') AND p.code IN ('parent.guardian.read', 'parent.finance.read'))
  )
ON CONFLICT DO NOTHING;

-- Allow assign_system_role_codes to include parent (bind path)
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
    IF v_code NOT IN ('owner', 'admin', 'staff', 'parent') THEN
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

CREATE OR REPLACE FUNCTION app.bind_guardian_user(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_guardian_id uuid,
  p_user_id uuid
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  display_name text,
  phone text,
  email text,
  status text,
  user_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  v_existing uuid;
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_guardian_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;
  IF NOT app.auth_has_active_membership(p_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'target user must have active membership' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM guardians g
    WHERE g.id = p_guardian_id AND g.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'guardian not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT g.user_id INTO v_existing
  FROM guardians g
  WHERE g.id = p_guardian_id AND g.tenant_id = p_tenant_id;

  IF v_existing IS NOT NULL AND v_existing <> p_user_id THEN
    RAISE EXCEPTION 'guardian already bound' USING ERRCODE = '23505';
  END IF;

  IF EXISTS (
    SELECT 1 FROM guardians g
    WHERE g.tenant_id = p_tenant_id
      AND g.user_id = p_user_id
      AND g.id <> p_guardian_id
  ) THEN
    RAISE EXCEPTION 'user already bound to another guardian' USING ERRCODE = '23505';
  END IF;

  UPDATE guardians g
  SET user_id = p_user_id, updated_at = now()
  WHERE g.id = p_guardian_id AND g.tenant_id = p_tenant_id;

  PERFORM app.assign_system_role_codes(
    p_actor_user_id, p_tenant_id, p_user_id, ARRAY['parent']::text[]
  );

  RETURN QUERY
  SELECT g.id, g.tenant_id, g.display_name, g.phone, g.email, g.status, g.user_id,
         g.created_at, g.updated_at
  FROM guardians g WHERE g.id = p_guardian_id AND g.tenant_id = p_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.unbind_guardian_user(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_guardian_id uuid
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  display_name text,
  phone text,
  email text,
  status text,
  user_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  v_bound uuid;
  v_parent_role uuid;
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_guardian_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;

  SELECT g.user_id INTO v_bound
  FROM guardians g
  WHERE g.id = p_guardian_id AND g.tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'guardian not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE guardians g
  SET user_id = NULL, updated_at = now()
  WHERE g.id = p_guardian_id AND g.tenant_id = p_tenant_id;

  IF v_bound IS NOT NULL THEN
    SELECT r.id INTO v_parent_role
    FROM roles r
    WHERE r.tenant_id = p_tenant_id AND r.code = 'parent' AND r.is_system = true
    LIMIT 1;

    IF v_parent_role IS NOT NULL THEN
      DELETE FROM user_roles ur
      WHERE ur.tenant_id = p_tenant_id
        AND ur.user_id = v_bound
        AND ur.role_id = v_parent_role
        AND ur.organization_id IS NULL;
    END IF;
  END IF;

  RETURN QUERY
  SELECT g.id, g.tenant_id, g.display_name, g.phone, g.email, g.status, g.user_id,
         g.created_at, g.updated_at
  FROM guardians g WHERE g.id = p_guardian_id AND g.tenant_id = p_tenant_id;
END;
$$;

COMMENT ON FUNCTION app.bind_guardian_user(uuid, uuid, uuid, uuid) IS
  'DBF-011: bind user to guardian + assign parent role.';
COMMENT ON FUNCTION app.unbind_guardian_user(uuid, uuid, uuid) IS
  'DBF-011: clear guardian user bind + remove parent role only.';

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT EXECUTE ON FUNCTION app.bind_guardian_user(uuid, uuid, uuid, uuid) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.unbind_guardian_user(uuid, uuid, uuid) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.assign_system_role_codes(uuid, uuid, uuid, text[]) TO educore_app;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION app.bind_guardian_user(uuid, uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.unbind_guardian_user(uuid, uuid, uuid) FROM PUBLIC;
