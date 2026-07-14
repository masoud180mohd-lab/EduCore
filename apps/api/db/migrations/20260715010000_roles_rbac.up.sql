-- IMP-001 P2 improvement (ADR-012): Identity RBAC scaffolding for Nest PermissionSource.
-- Tables: roles, role_permissions, user_roles. No HTTP controllers in this increment.
-- organization_id is nullable without FK until organizations table lands.

CREATE TABLE roles (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  code text NOT NULL,
  name text NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_roles_tenant_code UNIQUE (tenant_id, code),
  CONSTRAINT ck_roles_code_format CHECK (code ~ '^[a-z][a-z0-9_]{1,63}$')
);

COMMENT ON TABLE roles IS
  'Identity And Access: per-tenant RBAC roles (DBF-001). RLS Pattern A.';

CREATE TABLE role_permissions (
  role_id uuid NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

COMMENT ON TABLE role_permissions IS
  'Identity And Access: role → global permission map. Tenant isolation via roles.tenant_id.';

CREATE TABLE user_roles (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  user_id uuid NOT NULL REFERENCES users (id),
  role_id uuid NOT NULL REFERENCES roles (id),
  organization_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid NULL REFERENCES users (id)
);

COMMENT ON TABLE user_roles IS
  'Identity And Access: user ↔ role assignment in a tenant. organization_id FK deferred.';

COMMENT ON COLUMN user_roles.organization_id IS
  'Optional org scope; FK to organizations deferred until organizations migration.';

-- Ensure role belongs to same tenant as the assignment.
CREATE OR REPLACE FUNCTION app.user_roles_role_tenant_matches()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  role_tenant uuid;
BEGIN
  SELECT r.tenant_id INTO role_tenant FROM roles r WHERE r.id = NEW.role_id;
  IF role_tenant IS NULL OR role_tenant <> NEW.tenant_id THEN
    RAISE EXCEPTION 'user_roles.role_id must reference a role in the same tenant';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_user_roles_role_tenant
  BEFORE INSERT OR UPDATE OF role_id, tenant_id ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION app.user_roles_role_tenant_matches();

CREATE UNIQUE INDEX uq_user_roles_tenant_user_role_org
  ON user_roles (tenant_id, user_id, role_id, organization_id)
  NULLS NOT DISTINCT;

CREATE INDEX ix_user_roles_user_tenant ON user_roles (user_id, tenant_id);
CREATE INDEX ix_roles_tenant ON roles (tenant_id);
CREATE INDEX ix_role_permissions_permission ON role_permissions (permission_id);

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT SELECT ON TABLE roles TO educore_app;
    GRANT SELECT ON TABLE role_permissions TO educore_app;
    GRANT SELECT ON TABLE user_roles TO educore_app;
    REVOKE INSERT, UPDATE, DELETE ON TABLE roles FROM educore_app;
    REVOKE INSERT, UPDATE, DELETE ON TABLE role_permissions FROM educore_app;
    REVOKE INSERT, UPDATE, DELETE ON TABLE user_roles FROM educore_app;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_platform') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE roles TO educore_platform;
    GRANT SELECT, INSERT, UPDATE ON TABLE role_permissions TO educore_platform;
    GRANT SELECT, INSERT, UPDATE ON TABLE user_roles TO educore_platform;
    REVOKE DELETE ON TABLE roles FROM educore_platform;
    REVOKE DELETE ON TABLE role_permissions FROM educore_platform;
    REVOKE DELETE ON TABLE user_roles FROM educore_platform;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_migrator') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE roles TO educore_migrator;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE role_permissions TO educore_migrator;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_roles TO educore_migrator;
  END IF;
END
$$;

REVOKE ALL ON TABLE roles FROM PUBLIC;
REVOKE ALL ON TABLE role_permissions FROM PUBLIC;
REVOKE ALL ON TABLE user_roles FROM PUBLIC;

SELECT app.enable_tenant_rls('roles'::regclass);
SELECT app.enable_tenant_rls('user_roles'::regclass);
-- role_permissions has no tenant_id; FORCE RLS with join policies.
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions FORCE ROW LEVEL SECURITY;

-- roles policies
CREATE POLICY rls_roles_select ON roles
  FOR SELECT TO educore_app
  USING (tenant_id = app.current_tenant_id());

CREATE POLICY rls_roles_select_platform ON roles
  FOR SELECT TO educore_platform
  USING (app.is_trusted_platform_session());

CREATE POLICY rls_roles_insert_platform ON roles
  FOR INSERT TO educore_platform
  WITH CHECK (app.is_trusted_platform_session());

CREATE POLICY rls_roles_update_platform ON roles
  FOR UPDATE TO educore_platform
  USING (app.is_trusted_platform_session())
  WITH CHECK (app.is_trusted_platform_session());

-- user_roles policies
CREATE POLICY rls_user_roles_select ON user_roles
  FOR SELECT TO educore_app
  USING (
    tenant_id = app.current_tenant_id()
    OR user_id = app.current_user_id()
  );

CREATE POLICY rls_user_roles_select_platform ON user_roles
  FOR SELECT TO educore_platform
  USING (app.is_trusted_platform_session());

CREATE POLICY rls_user_roles_insert_platform ON user_roles
  FOR INSERT TO educore_platform
  WITH CHECK (app.is_trusted_platform_session());

CREATE POLICY rls_user_roles_update_platform ON user_roles
  FOR UPDATE TO educore_platform
  USING (app.is_trusted_platform_session())
  WITH CHECK (app.is_trusted_platform_session());

-- role_permissions: visible when owning role is in current tenant (or trusted platform)
CREATE POLICY rls_role_permissions_select ON role_permissions
  FOR SELECT TO educore_app
  USING (
    EXISTS (
      SELECT 1
      FROM roles r
      WHERE r.id = role_permissions.role_id
        AND r.tenant_id = app.current_tenant_id()
    )
  );

CREATE POLICY rls_role_permissions_select_platform ON role_permissions
  FOR SELECT TO educore_platform
  USING (app.is_trusted_platform_session());

CREATE POLICY rls_role_permissions_insert_platform ON role_permissions
  FOR INSERT TO educore_platform
  WITH CHECK (app.is_trusted_platform_session());

CREATE POLICY rls_role_permissions_update_platform ON role_permissions
  FOR UPDATE TO educore_platform
  USING (app.is_trusted_platform_session())
  WITH CHECK (app.is_trusted_platform_session());

-- Effective permission codes for current_user in target tenant (Nest PermissionSource).
CREATE OR REPLACE FUNCTION app.user_permission_codes(target_tenant_id uuid)
RETURNS SETOF text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
  IF target_tenant_id IS NULL OR app.current_user_id() IS NULL THEN
    RETURN;
  END IF;

  IF NOT app.user_has_active_membership(target_tenant_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT DISTINCT p.code
  FROM user_roles ur
  INNER JOIN roles r
    ON r.id = ur.role_id
   AND r.tenant_id = ur.tenant_id
  INNER JOIN role_permissions rp
    ON rp.role_id = r.id
  INNER JOIN permissions p
    ON p.id = rp.permission_id
  WHERE ur.tenant_id = target_tenant_id
    AND ur.user_id = app.current_user_id();
END;
$$;

COMMENT ON FUNCTION app.user_permission_codes(uuid) IS
  'Active membership + DISTINCT permission codes for current_user in tenant. SECURITY DEFINER.';

GRANT EXECUTE ON FUNCTION app.user_permission_codes(uuid) TO educore_app;
GRANT EXECUTE ON FUNCTION app.user_permission_codes(uuid) TO educore_platform;
