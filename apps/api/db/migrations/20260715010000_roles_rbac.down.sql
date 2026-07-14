-- Down: Identity RBAC scaffolding (roles / role_permissions / user_roles).

DROP FUNCTION IF EXISTS app.user_permission_codes(uuid);

DROP POLICY IF EXISTS rls_role_permissions_update_platform ON role_permissions;
DROP POLICY IF EXISTS rls_role_permissions_insert_platform ON role_permissions;
DROP POLICY IF EXISTS rls_role_permissions_select_platform ON role_permissions;
DROP POLICY IF EXISTS rls_role_permissions_select ON role_permissions;

DROP POLICY IF EXISTS rls_user_roles_update_platform ON user_roles;
DROP POLICY IF EXISTS rls_user_roles_insert_platform ON user_roles;
DROP POLICY IF EXISTS rls_user_roles_select_platform ON user_roles;
DROP POLICY IF EXISTS rls_user_roles_select ON user_roles;

DROP POLICY IF EXISTS rls_roles_update_platform ON roles;
DROP POLICY IF EXISTS rls_roles_insert_platform ON roles;
DROP POLICY IF EXISTS rls_roles_select_platform ON roles;
DROP POLICY IF EXISTS rls_roles_select ON roles;

DROP TRIGGER IF EXISTS trg_user_roles_role_tenant ON user_roles;
DROP FUNCTION IF EXISTS app.user_roles_role_tenant_matches();

DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS roles;
