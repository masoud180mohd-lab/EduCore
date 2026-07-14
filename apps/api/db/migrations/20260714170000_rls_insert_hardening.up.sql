-- AUDIT-R2 / G3: Harden INSERT trust boundary against GUC spoofing.
-- Problem: educore_app could SET app.rls_mode='bootstrap' and INSERT without being a platform operator.
-- Fix:
--   1) Replace INSERT policies with AND of is_platform_operator + rls_mode.
--   2) REVOKE INSERT on tenants/users from educore_app (runtime cannot create tenants/users via SQL alone).
--   3) GRANT INSERT to educore_platform (trusted provisioning role only).
--   4) Platform INSERT policies still require both privileged GUCs (defense in depth).

-- ---------------------------------------------------------------------------
-- Platform provisioning role (local password placeholder; not for NestJS pool)
-- ---------------------------------------------------------------------------

DO
$$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_platform') THEN
    CREATE ROLE educore_platform LOGIN PASSWORD 'educore_platform_local_only';
  END IF;
END
$$;

DO
$$
DECLARE
  db_name text := current_database();
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO educore_platform', db_name);
END
$$;

GRANT USAGE ON SCHEMA public TO educore_platform;
GRANT USAGE ON SCHEMA app TO educore_app;
GRANT USAGE ON SCHEMA app TO educore_platform;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO educore_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO educore_platform;

COMMENT ON ROLE educore_platform IS
  'Trusted provisioning role for tenant/user INSERT. Never use as NestJS runtime pool. GUC must still be set.';

-- ---------------------------------------------------------------------------
-- Privilege split: runtime vs platform
-- ---------------------------------------------------------------------------

REVOKE INSERT ON TABLE tenants FROM educore_app;
REVOKE INSERT ON TABLE users FROM educore_app;

GRANT SELECT, UPDATE ON TABLE tenants TO educore_app;
GRANT SELECT, UPDATE ON TABLE users TO educore_app;
REVOKE DELETE ON TABLE tenants FROM educore_app;
REVOKE DELETE ON TABLE users FROM educore_app;

GRANT SELECT, INSERT, UPDATE ON TABLE tenants TO educore_platform;
GRANT SELECT, INSERT, UPDATE ON TABLE users TO educore_platform;
REVOKE DELETE ON TABLE tenants FROM educore_platform;
REVOKE DELETE ON TABLE users FROM educore_platform;

GRANT SELECT ON TABLE permissions TO educore_platform;
GRANT SELECT ON TABLE plans TO educore_platform;
REVOKE INSERT, UPDATE, DELETE ON TABLE permissions FROM educore_platform;
REVOKE INSERT, UPDATE, DELETE ON TABLE plans FROM educore_platform;

-- ---------------------------------------------------------------------------
-- Helpers: privileged write must never be single-GUC spoofable
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.require_platform_write()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT app.is_platform_operator()
    AND app.rls_mode() IN ('bootstrap', 'platform');
$$;

COMMENT ON FUNCTION app.require_platform_write() IS
  'AUDIT-R2: privileged write GUCs require BOTH platform operator flag AND bootstrap/platform rls_mode.';

-- Platform break-glass visibility is bound to DB role educore_platform, not GUCs alone.
CREATE OR REPLACE FUNCTION app.is_trusted_platform_session()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT current_user = 'educore_platform'
    AND app.require_platform_write();
$$;

COMMENT ON FUNCTION app.is_trusted_platform_session() IS
  'AUDIT-R2: platform bypass requires educore_platform role + both privileged GUCs (blocks educore_app GUC spoofing).';

-- Rebind Pattern B/C helpers so educore_app cannot promote itself via GUCs.
CREATE OR REPLACE FUNCTION app.can_see_tenant(target_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT target_tenant_id IS NOT NULL
    AND (
      target_tenant_id = app.current_tenant_id()
      OR app.is_trusted_platform_session()
      OR app.user_has_active_membership(target_tenant_id)
    );
$$;

CREATE OR REPLACE FUNCTION app.can_see_user(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT target_user_id IS NOT NULL
    AND (
      target_user_id = app.current_user_id()
      OR app.is_trusted_platform_session()
    );
$$;

-- ---------------------------------------------------------------------------
-- Force RLS (re-assert)
-- ---------------------------------------------------------------------------

SELECT app.enable_tenant_rls('tenants'::regclass);
SELECT app.enable_tenant_rls('users'::regclass);

-- ---------------------------------------------------------------------------
-- Replace INSERT policies (drop spoofable educore_app INSERT policies)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS rls_tenants_insert ON tenants;
CREATE POLICY rls_tenants_insert_platform
  ON tenants
  FOR INSERT
  TO educore_platform
  WITH CHECK (app.is_trusted_platform_session());

DROP POLICY IF EXISTS rls_users_insert ON users;
CREATE POLICY rls_users_insert_platform
  ON users
  FOR INSERT
  TO educore_platform
  WITH CHECK (app.is_trusted_platform_session());

-- Platform SELECT (policy TO role; helpers already allow trusted platform).
DROP POLICY IF EXISTS rls_tenants_select_platform ON tenants;
CREATE POLICY rls_tenants_select_platform
  ON tenants
  FOR SELECT
  TO educore_platform
  USING (app.can_see_tenant(id));

DROP POLICY IF EXISTS rls_users_select_platform ON users;
CREATE POLICY rls_users_select_platform
  ON users
  FOR SELECT
  TO educore_platform
  USING (app.can_see_user(id));

-- Tighten UPDATE: educore_app may update only self (users) / visible tenant (tenants);
-- remove GUC-only platform branch from educore_app UPDATE policy.
DROP POLICY IF EXISTS rls_users_update ON users;
CREATE POLICY rls_users_update
  ON users
  FOR UPDATE
  TO educore_app
  USING (id = app.current_user_id())
  WITH CHECK (id = app.current_user_id());

DROP POLICY IF EXISTS rls_users_update_platform ON users;
CREATE POLICY rls_users_update_platform
  ON users
  FOR UPDATE
  TO educore_platform
  USING (app.is_trusted_platform_session())
  WITH CHECK (app.is_trusted_platform_session());

DROP POLICY IF EXISTS rls_tenants_update_platform ON tenants;
CREATE POLICY rls_tenants_update_platform
  ON tenants
  FOR UPDATE
  TO educore_platform
  USING (app.is_trusted_platform_session())
  WITH CHECK (app.is_trusted_platform_session());
