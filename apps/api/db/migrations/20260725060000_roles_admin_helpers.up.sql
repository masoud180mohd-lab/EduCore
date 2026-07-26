-- IMP-022: Tenant role administration write helpers.
-- educore_app remains SELECT-only on roles, role_permissions, and user_roles.

CREATE OR REPLACE FUNCTION app.create_custom_role(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_role_id uuid,
  p_code text,
  p_name text,
  p_permission_codes text[]
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  code text,
  name text,
  is_system boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  v_permission_codes text[] := COALESCE(p_permission_codes, ARRAY[]::text[]);
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_role_id IS NULL
     OR p_code IS NULL OR p_code !~ '^[a-z][a-z0-9_]{1,63}$'
     OR p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'invalid role parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;
  IF (
    SELECT count(DISTINCT requested.code)
    FROM unnest(v_permission_codes) AS requested(code)
  ) <> (
    SELECT count(*)
    FROM permissions p
    WHERE p.code = ANY(v_permission_codes)
  ) THEN
    RAISE EXCEPTION 'unknown permission code' USING ERRCODE = '22023';
  END IF;

  INSERT INTO roles (id, tenant_id, code, name, is_system)
  VALUES (p_role_id, p_tenant_id, p_code, btrim(p_name), false);

  INSERT INTO role_permissions (role_id, permission_id)
  SELECT p_role_id, p.id
  FROM permissions p
  WHERE p.code = ANY(v_permission_codes);

  RETURN QUERY
  SELECT r.id, r.tenant_id, r.code, r.name, r.is_system, r.created_at, r.updated_at
  FROM roles r
  WHERE r.id = p_role_id AND r.tenant_id = p_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.rename_role(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_role_id uuid,
  p_name text
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  code text,
  name text,
  is_system boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_role_id IS NULL
     OR p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'invalid role parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  UPDATE roles r
  SET name = btrim(p_name), updated_at = now()
  WHERE r.id = p_role_id AND r.tenant_id = p_tenant_id
  RETURNING r.id, r.tenant_id, r.code, r.name, r.is_system, r.created_at, r.updated_at;
END;
$$;

CREATE OR REPLACE FUNCTION app.replace_role_permissions(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_role_id uuid,
  p_permission_codes text[]
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  code text,
  name text,
  is_system boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  v_is_system boolean;
  v_permission_codes text[] := COALESCE(p_permission_codes, ARRAY[]::text[]);
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_role_id IS NULL THEN
    RAISE EXCEPTION 'invalid role parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;

  SELECT r.is_system INTO v_is_system
  FROM roles r
  WHERE r.id = p_role_id AND r.tenant_id = p_tenant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  IF v_is_system THEN
    RAISE EXCEPTION 'system role permissions cannot be edited' USING ERRCODE = '42501';
  END IF;
  IF (
    SELECT count(DISTINCT requested.code)
    FROM unnest(v_permission_codes) AS requested(code)
  ) <> (
    SELECT count(*)
    FROM permissions p
    WHERE p.code = ANY(v_permission_codes)
  ) THEN
    RAISE EXCEPTION 'unknown permission code' USING ERRCODE = '22023';
  END IF;

  DELETE FROM role_permissions rp WHERE rp.role_id = p_role_id;
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT p_role_id, p.id
  FROM permissions p
  WHERE p.code = ANY(v_permission_codes);
  UPDATE roles r SET updated_at = now() WHERE r.id = p_role_id;

  RETURN QUERY
  SELECT r.id, r.tenant_id, r.code, r.name, r.is_system, r.created_at, r.updated_at
  FROM roles r
  WHERE r.id = p_role_id AND r.tenant_id = p_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.assign_user_role(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_user_role_id uuid,
  p_user_id uuid,
  p_role_id uuid
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  user_id uuid,
  role_id uuid,
  organization_id uuid,
  created_at timestamptz,
  created_by_user_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_user_role_id IS NULL
     OR p_user_id IS NULL OR p_role_id IS NULL THEN
    RAISE EXCEPTION 'invalid user role parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM roles r WHERE r.id = p_role_id AND r.tenant_id = p_tenant_id
  ) OR NOT EXISTS (
    SELECT 1 FROM tenant_memberships m
    WHERE m.tenant_id = p_tenant_id
      AND m.user_id = p_user_id
      AND m.status <> 'removed'
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  INSERT INTO user_roles (
    id, tenant_id, user_id, role_id, organization_id, created_by_user_id
  )
  VALUES (
    p_user_role_id, p_tenant_id, p_user_id, p_role_id, NULL, p_actor_user_id
  )
  RETURNING user_roles.id, user_roles.tenant_id, user_roles.user_id,
            user_roles.role_id, user_roles.organization_id,
            user_roles.created_at, user_roles.created_by_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.unassign_user_role(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_user_role_id uuid
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  user_id uuid,
  role_id uuid,
  organization_id uuid,
  created_at timestamptz,
  created_by_user_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_user_role_id IS NULL THEN
    RAISE EXCEPTION 'invalid user role parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  DELETE FROM user_roles ur
  WHERE ur.id = p_user_role_id AND ur.tenant_id = p_tenant_id
  RETURNING ur.id, ur.tenant_id, ur.user_id, ur.role_id, ur.organization_id,
            ur.created_at, ur.created_by_user_id;
END;
$$;

COMMENT ON FUNCTION app.create_custom_role(uuid, uuid, uuid, text, text, text[]) IS
  'IMP-022: Create a tenant custom role and initial permission set.';
COMMENT ON FUNCTION app.rename_role(uuid, uuid, uuid, text) IS
  'IMP-022: Rename a tenant role.';
COMMENT ON FUNCTION app.replace_role_permissions(uuid, uuid, uuid, text[]) IS
  'IMP-022: Replace custom role permissions; system roles are forbidden.';
COMMENT ON FUNCTION app.assign_user_role(uuid, uuid, uuid, uuid, uuid) IS
  'IMP-022: Create tenant-wide user role assignment (organization_id NULL).';
COMMENT ON FUNCTION app.unassign_user_role(uuid, uuid, uuid) IS
  'IMP-022: Delete a tenant user role assignment.';

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT EXECUTE ON FUNCTION app.create_custom_role(uuid, uuid, uuid, text, text, text[]) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.rename_role(uuid, uuid, uuid, text) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.replace_role_permissions(uuid, uuid, uuid, text[]) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.assign_user_role(uuid, uuid, uuid, uuid, uuid) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.unassign_user_role(uuid, uuid, uuid) TO educore_app;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION app.create_custom_role(uuid, uuid, uuid, text, text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.rename_role(uuid, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.replace_role_permissions(uuid, uuid, uuid, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.assign_user_role(uuid, uuid, uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.unassign_user_role(uuid, uuid, uuid) FROM PUBLIC;
