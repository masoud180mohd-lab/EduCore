-- IMP-016: Org PATCH/deactivate + user disable SECURITY DEFINER helpers.
-- Table UPDATE remains via DEFINER for organizations (educore_app has no UPDATE).
-- Users: disable via DEFINER for consistent AuthZ/visibility checks.

-- ---------------------------------------------------------------------------
-- Update organization (partial): name, code, parentOrganizationId
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.update_organization(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_org_id uuid,
  p_set_name boolean,
  p_name text,
  p_set_code boolean,
  p_code text,
  p_set_parent boolean,
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
  IF NOT COALESCE(p_set_name, false)
     AND NOT COALESCE(p_set_code, false)
     AND NOT COALESCE(p_set_parent, false) THEN
    RAISE EXCEPTION 'no fields to update' USING ERRCODE = '22023';
  END IF;
  IF p_set_name THEN
    IF p_name IS NULL OR char_length(btrim(p_name)) < 1 OR char_length(btrim(p_name)) > 200 THEN
      RAISE EXCEPTION 'invalid name' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF p_set_code AND p_code IS NOT NULL AND btrim(p_code) <> '' THEN
    IF btrim(p_code) !~ '^[a-z0-9-]{2,64}$' THEN
      RAISE EXCEPTION 'invalid code' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM organizations o WHERE o.id = p_org_id AND o.tenant_id = p_tenant_id
  ) THEN
    RETURN;
  END IF;

  IF p_set_parent AND p_parent_organization_id IS NOT NULL THEN
    IF p_parent_organization_id = p_org_id THEN
      RAISE EXCEPTION 'invalid parent' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM organizations p
      WHERE p.id = p_parent_organization_id
        AND p.tenant_id = p_tenant_id
    ) THEN
      RAISE EXCEPTION 'parent organization not found' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  UPDATE organizations o
  SET
    name = CASE WHEN p_set_name THEN btrim(p_name) ELSE o.name END,
    code = CASE
      WHEN p_set_code THEN NULLIF(btrim(COALESCE(p_code, '')), '')
      ELSE o.code
    END,
    parent_organization_id = CASE
      WHEN p_set_parent THEN p_parent_organization_id
      ELSE o.parent_organization_id
    END,
    updated_at = now()
  WHERE o.id = p_org_id AND o.tenant_id = p_tenant_id;

  RETURN QUERY
  SELECT o.id, o.tenant_id, o.org_type, o.name, o.code, o.status,
         o.parent_organization_id, o.created_at, o.updated_at
  FROM organizations o
  WHERE o.id = p_org_id AND o.tenant_id = p_tenant_id;
END;
$$;

COMMENT ON FUNCTION app.update_organization(uuid, uuid, uuid, boolean, text, boolean, text, boolean, uuid) IS
  'IMP-016: Partial update organization in bound tenant. SECURITY DEFINER; AuthZ organization.manage in Nest.';

-- ---------------------------------------------------------------------------
-- Deactivate organization → status inactive (idempotent)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.deactivate_organization(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_org_id uuid
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
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM organizations o WHERE o.id = p_org_id AND o.tenant_id = p_tenant_id
  ) THEN
    RETURN;
  END IF;

  UPDATE organizations o
  SET status = 'inactive',
      updated_at = now()
  WHERE o.id = p_org_id
    AND o.tenant_id = p_tenant_id
    AND o.status IS DISTINCT FROM 'inactive';

  RETURN QUERY
  SELECT o.id, o.tenant_id, o.org_type, o.name, o.code, o.status,
         o.parent_organization_id, o.created_at, o.updated_at
  FROM organizations o
  WHERE o.id = p_org_id AND o.tenant_id = p_tenant_id;
END;
$$;

COMMENT ON FUNCTION app.deactivate_organization(uuid, uuid, uuid) IS
  'IMP-016: Set organization status to inactive. SECURITY DEFINER; AuthZ organization.manage in Nest.';

-- ---------------------------------------------------------------------------
-- Disable user (platform status) visible via active membership in tenant
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.disable_user(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_target_user_id uuid
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
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;
  -- Visibility: target must have active membership in bound tenant.
  IF NOT EXISTS (
    SELECT 1
    FROM tenant_memberships m
    WHERE m.user_id = p_target_user_id
      AND m.tenant_id = p_tenant_id
      AND m.status = 'active'
  ) THEN
    RETURN;
  END IF;

  UPDATE users u
  SET status = 'disabled',
      updated_at = now()
  WHERE u.id = p_target_user_id
    AND u.status IS DISTINCT FROM 'disabled';

  RETURN QUERY
  SELECT u.id, u.email, u.display_name, u.status,
         u.email_verified_at, u.last_login_at, u.created_at, u.updated_at
  FROM users u
  WHERE u.id = p_target_user_id;
END;
$$;

COMMENT ON FUNCTION app.disable_user(uuid, uuid, uuid) IS
  'IMP-016: Set user status to disabled. SECURITY DEFINER; AuthZ user.manage in Nest; reject self in Nest.';

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT EXECUTE ON FUNCTION app.update_organization(uuid, uuid, uuid, boolean, text, boolean, text, boolean, uuid) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.deactivate_organization(uuid, uuid, uuid) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.disable_user(uuid, uuid, uuid) TO educore_app;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION app.update_organization(uuid, uuid, uuid, boolean, text, boolean, text, boolean, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.deactivate_organization(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.disable_user(uuid, uuid, uuid) FROM PUBLIC;
