DROP POLICY IF EXISTS rls_users_update ON users;
DROP POLICY IF EXISTS rls_users_insert ON users;
DROP POLICY IF EXISTS rls_users_select ON users;

DROP POLICY IF EXISTS rls_tenants_update ON tenants;
DROP POLICY IF EXISTS rls_tenants_insert ON tenants;
DROP POLICY IF EXISTS rls_tenants_select ON tenants;

DROP FUNCTION IF EXISTS app.can_see_user(uuid);
DROP FUNCTION IF EXISTS app.user_has_active_membership(uuid);
DROP FUNCTION IF EXISTS app.can_see_tenant(uuid);

-- FORCE/ENABLE RLS left on tables until tables drop; cleared when tables drop in prior migration.
