-- IMP-001 P6: organizations table (DBF-001) for product read path GET /organizations.
-- No HTTP writes; educore_app is SELECT-only under conditional freeze.

CREATE TABLE organizations (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  org_type text NOT NULL,
  name text NOT NULL,
  code text NULL,
  status text NOT NULL,
  parent_organization_id uuid NULL REFERENCES organizations (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_organizations_org_type CHECK (org_type IN ('school', 'campus', 'department')),
  CONSTRAINT ck_organizations_status CHECK (status IN ('active', 'inactive')),
  CONSTRAINT ck_organizations_name_len CHECK (char_length(name) BETWEEN 1 AND 200),
  CONSTRAINT ck_organizations_code_format CHECK (
    code IS NULL OR code ~ '^[a-z0-9-]{2,64}$'
  )
);

COMMENT ON TABLE organizations IS
  'Tenant And Billing: schools / campuses / units under a tenant. RLS Pattern A.';

CREATE UNIQUE INDEX uq_organizations_tenant_code
  ON organizations (tenant_id, code)
  WHERE code IS NOT NULL;

CREATE INDEX ix_organizations_tenant_status ON organizations (tenant_id, status);
CREATE INDEX ix_organizations_tenant_name ON organizations (tenant_id, name);

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT SELECT ON TABLE organizations TO educore_app;
    REVOKE INSERT, UPDATE, DELETE ON TABLE organizations FROM educore_app;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_platform') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE organizations TO educore_platform;
    REVOKE DELETE ON TABLE organizations FROM educore_platform;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_migrator') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE organizations TO educore_migrator;
  END IF;
END
$$;

REVOKE ALL ON TABLE organizations FROM PUBLIC;

SELECT app.enable_tenant_rls('organizations'::regclass);

-- Pattern A: tenant-scoped SELECT for app role.
CREATE POLICY rls_organizations_select ON organizations
  FOR SELECT TO educore_app
  USING (tenant_id = app.current_tenant_id());

CREATE POLICY rls_organizations_select_platform ON organizations
  FOR SELECT TO educore_platform
  USING (app.is_trusted_platform_session());

CREATE POLICY rls_organizations_insert_platform ON organizations
  FOR INSERT TO educore_platform
  WITH CHECK (app.is_trusted_platform_session());

CREATE POLICY rls_organizations_update_platform ON organizations
  FOR UPDATE TO educore_platform
  USING (app.is_trusted_platform_session())
  WITH CHECK (app.is_trusted_platform_session());

-- No DELETE policies for runtime roles → deny by default.
