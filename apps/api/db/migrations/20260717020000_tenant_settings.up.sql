-- IMP-001 P6c: tenant_settings table (DBF-001 + ACF schemaVersion) for GET /tenant-settings.
-- No HTTP writes; educore_app is SELECT-only under conditional freeze.

CREATE TABLE tenant_settings (
  tenant_id uuid PRIMARY KEY REFERENCES tenants (id),
  schema_version integer NOT NULL DEFAULT 1,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id uuid NULL REFERENCES users (id),
  CONSTRAINT ck_tenant_settings_schema_version CHECK (schema_version >= 1),
  CONSTRAINT ck_tenant_settings_settings_object CHECK (jsonb_typeof(settings) = 'object')
);

COMMENT ON TABLE tenant_settings IS
  'Tenant And Billing: 1:1 tenant configuration document. RLS Pattern A.';

COMMENT ON COLUMN tenant_settings.schema_version IS
  'ACF settings document version; application validates shape on write (write closed).';

COMMENT ON COLUMN tenant_settings.settings IS
  'Controlled jsonb document; never free-form dumps. May hold operational prefs.';

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT SELECT ON TABLE tenant_settings TO educore_app;
    REVOKE INSERT, UPDATE, DELETE ON TABLE tenant_settings FROM educore_app;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_platform') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE tenant_settings TO educore_platform;
    REVOKE DELETE ON TABLE tenant_settings FROM educore_platform;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_migrator') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE tenant_settings TO educore_migrator;
  END IF;
END
$$;

REVOKE ALL ON TABLE tenant_settings FROM PUBLIC;

SELECT app.enable_tenant_rls('tenant_settings'::regclass);

CREATE POLICY rls_tenant_settings_select ON tenant_settings
  FOR SELECT TO educore_app
  USING (tenant_id = app.current_tenant_id());

CREATE POLICY rls_tenant_settings_select_platform ON tenant_settings
  FOR SELECT TO educore_platform
  USING (app.is_trusted_platform_session());

CREATE POLICY rls_tenant_settings_insert_platform ON tenant_settings
  FOR INSERT TO educore_platform
  WITH CHECK (app.is_trusted_platform_session());

CREATE POLICY rls_tenant_settings_update_platform ON tenant_settings
  FOR UPDATE TO educore_platform
  USING (app.is_trusted_platform_session())
  WITH CHECK (app.is_trusted_platform_session());

-- No DELETE policies for runtime roles → deny by default.
