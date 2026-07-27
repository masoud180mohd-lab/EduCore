-- IMP-026: Org-scoped user-role assignment storage (admin only; AuthZ union unchanged).

ALTER TABLE user_roles
  ADD CONSTRAINT fk_user_roles_organization
  FOREIGN KEY (organization_id) REFERENCES organizations (id);

CREATE OR REPLACE FUNCTION app.user_roles_organization_tenant_matches()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM organizations o
    WHERE o.id = NEW.organization_id AND o.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'user_roles.organization_id must reference an organization in the same tenant'
      USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_roles_organization_tenant ON user_roles;
CREATE TRIGGER trg_user_roles_organization_tenant
  BEFORE INSERT OR UPDATE OF organization_id, tenant_id ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION app.user_roles_organization_tenant_matches();

DROP FUNCTION IF EXISTS app.assign_user_role(uuid, uuid, uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION app.assign_user_role(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_user_role_id uuid,
  p_user_id uuid,
  p_role_id uuid,
  p_organization_id uuid
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
  IF p_organization_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM organizations o
    WHERE o.id = p_organization_id AND o.tenant_id = p_tenant_id
  ) THEN
    RETURN;
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
    p_user_role_id, p_tenant_id, p_user_id, p_role_id, p_organization_id, p_actor_user_id
  )
  RETURNING user_roles.id, user_roles.tenant_id, user_roles.user_id,
            user_roles.role_id, user_roles.organization_id,
            user_roles.created_at, user_roles.created_by_user_id;
END;
$$;

COMMENT ON FUNCTION app.assign_user_role(uuid, uuid, uuid, uuid, uuid, uuid) IS
  'IMP-026: Assign role tenant-wide (NULL org) or scoped to organization in tenant.';

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT EXECUTE ON FUNCTION app.assign_user_role(
      uuid, uuid, uuid, uuid, uuid, uuid
    ) TO educore_app;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION app.assign_user_role(
  uuid, uuid, uuid, uuid, uuid, uuid
) FROM PUBLIC;
