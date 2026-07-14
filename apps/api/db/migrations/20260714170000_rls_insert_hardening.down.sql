-- Reverse AUDIT-R2 INSERT hardening (restores prior spoofable model — test/dev rollback only).

DROP POLICY IF EXISTS rls_tenants_select_platform ON tenants;
DROP POLICY IF EXISTS rls_users_select_platform ON users;
DROP POLICY IF EXISTS rls_tenants_insert_platform ON tenants;
DROP POLICY IF EXISTS rls_users_insert_platform ON users;
DROP POLICY IF EXISTS rls_users_update_platform ON users;
DROP POLICY IF EXISTS rls_tenants_update_platform ON tenants;

DROP POLICY IF EXISTS rls_users_update ON users;
CREATE POLICY rls_users_update
  ON users
  FOR UPDATE
  TO educore_app
  USING (
    id = app.current_user_id()
    OR (
      app.is_platform_operator()
      AND app.rls_mode() IN ('platform', 'bootstrap')
    )
  )
  WITH CHECK (
    id = app.current_user_id()
    OR (
      app.is_platform_operator()
      AND app.rls_mode() IN ('platform', 'bootstrap')
    )
  );

-- Restore pre-AUDIT-R2 visibility helpers (GUC-only platform path).
CREATE OR REPLACE FUNCTION app.can_see_tenant(target_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT target_tenant_id IS NOT NULL
    AND (
      target_tenant_id = app.current_tenant_id()
      OR (
        app.is_platform_operator()
        AND app.rls_mode() IN ('platform', 'bootstrap')
      )
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
      OR (
        app.is_platform_operator()
        AND app.rls_mode() IN ('platform', 'bootstrap')
      )
    );
$$;

DROP FUNCTION IF EXISTS app.is_trusted_platform_session();
DROP FUNCTION IF EXISTS app.require_platform_write();

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE tenants TO educore_app;
    GRANT SELECT, INSERT, UPDATE ON TABLE users TO educore_app;
    REVOKE DELETE ON TABLE tenants FROM educore_app;
    REVOKE DELETE ON TABLE users FROM educore_app;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_platform') THEN
    REVOKE ALL ON TABLE tenants FROM educore_platform;
    REVOKE ALL ON TABLE users FROM educore_platform;
    REVOKE ALL ON TABLE permissions FROM educore_platform;
    REVOKE ALL ON TABLE plans FROM educore_platform;
  END IF;
END
$$;

DROP POLICY IF EXISTS rls_tenants_insert ON tenants;
CREATE POLICY rls_tenants_insert
  ON tenants
  FOR INSERT
  TO educore_app
  WITH CHECK (
    app.is_platform_operator()
    OR app.rls_mode() IN ('bootstrap', 'platform')
  );

DROP POLICY IF EXISTS rls_users_insert ON users;
CREATE POLICY rls_users_insert
  ON users
  FOR INSERT
  TO educore_app
  WITH CHECK (
    app.is_platform_operator()
    OR app.rls_mode() IN ('bootstrap', 'platform')
  );
