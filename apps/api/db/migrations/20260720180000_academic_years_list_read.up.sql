-- IMP-003 P0 / DBF-003: academic_years table + academic.read for GET /api/v1/academic-years.
-- educore_app is SELECT-only. No academic write HTTP in this slice.

CREATE TABLE academic_years (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  name text NOT NULL,
  code text NULL,
  starts_on date NULL,
  ends_on date NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_academic_years_name_len CHECK (char_length(name) BETWEEN 1 AND 200),
  CONSTRAINT ck_academic_years_status CHECK (status IN ('draft', 'active', 'closed')),
  CONSTRAINT ck_academic_years_code_format CHECK (
    code IS NULL OR code ~ '^[A-Za-z0-9._/-]{1,64}$'
  ),
  CONSTRAINT ck_academic_years_date_range CHECK (
    starts_on IS NULL OR ends_on IS NULL OR ends_on >= starts_on
  )
);

COMMENT ON TABLE academic_years IS
  'Academic Structure: tenant-owned academic year (list-read slice DBF-003).';

CREATE UNIQUE INDEX uq_academic_years_tenant_code
  ON academic_years (tenant_id, code)
  WHERE code IS NOT NULL;

CREATE INDEX ix_academic_years_tenant_status ON academic_years (tenant_id, status);
CREATE INDEX ix_academic_years_tenant_starts_on ON academic_years (tenant_id, starts_on DESC NULLS LAST);

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT SELECT ON TABLE academic_years TO educore_app;
    REVOKE INSERT, UPDATE, DELETE ON TABLE academic_years FROM educore_app;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_platform') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE academic_years TO educore_platform;
    REVOKE DELETE ON TABLE academic_years FROM educore_platform;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_migrator') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE academic_years TO educore_migrator;
  END IF;
END
$$;

REVOKE ALL ON TABLE academic_years FROM PUBLIC;

SELECT app.enable_tenant_rls('academic_years'::regclass);

CREATE POLICY rls_academic_years_select ON academic_years
  FOR SELECT TO educore_app
  USING (tenant_id = app.current_tenant_id());

CREATE POLICY rls_academic_years_select_platform ON academic_years
  FOR SELECT TO educore_platform
  USING (app.is_trusted_platform_session());

CREATE POLICY rls_academic_years_insert_platform ON academic_years
  FOR INSERT TO educore_platform
  WITH CHECK (app.is_trusted_platform_session());

CREATE POLICY rls_academic_years_update_platform ON academic_years
  FOR UPDATE TO educore_platform
  USING (app.is_trusted_platform_session())
  WITH CHECK (app.is_trusted_platform_session());

INSERT INTO permissions (id, code, description) VALUES
  (
    '01900000-0001-7000-8000-000000000010',
    'academic.read',
    'List and view academic structure in tenant'
  )
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, now()
FROM roles r
CROSS JOIN permissions p
WHERE r.is_system = true
  AND r.code IN ('owner', 'admin', 'staff')
  AND p.code = 'academic.read'
ON CONFLICT DO NOTHING;
