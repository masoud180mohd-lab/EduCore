DROP FUNCTION IF EXISTS app.enable_tenant_rls(regclass);
DROP FUNCTION IF EXISTS app.tenant_isolation_passes(uuid);
DROP FUNCTION IF EXISTS app.rls_mode();
DROP FUNCTION IF EXISTS app.is_platform_operator();
DROP FUNCTION IF EXISTS app.current_user_id();
DROP FUNCTION IF EXISTS app.current_tenant_id();
DROP SCHEMA IF EXISTS app CASCADE;
