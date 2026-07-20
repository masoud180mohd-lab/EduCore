-- IMP-003-C0 / DBF-005: classes table for GET /api/v1/classes.
-- educore_app is SELECT-only. Permission: reuses academic.read.

CREATE TABLE classes (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  academic_year_id uuid NOT NULL REFERENCES academic_years (id),
  term_id uuid NULL REFERENCES terms (id),
  name text NOT NULL,
  code text NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_classes_name_len CHECK (char_length(name) BETWEEN 1 AND 200),
  CONSTRAINT ck_classes_status CHECK (status IN ('draft', 'active', 'closed')),
  CONSTRAINT ck_classes_code_format CHECK (
    code IS NULL OR code ~ '^[A-Za-z0-9._/-]{1,64}$'
  )
);

COMMENT ON TABLE classes IS
  'Academic Structure: tenant-owned class under an academic year (list-read DBF-005).';

CREATE UNIQUE INDEX uq_classes_tenant_year_code
  ON classes (tenant_id, academic_year_id, code)
  WHERE code IS NOT NULL;

CREATE INDEX ix_classes_tenant_year_status
  ON classes (tenant_id, academic_year_id, status);

CREATE INDEX ix_classes_tenant_year_name
  ON classes (tenant_id, academic_year_id, name ASC);

CREATE INDEX ix_classes_tenant_term
  ON classes (tenant_id, term_id)
  WHERE term_id IS NOT NULL;

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT SELECT ON TABLE classes TO educore_app;
    REVOKE INSERT, UPDATE, DELETE ON TABLE classes FROM educore_app;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_platform') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE classes TO educore_platform;
    REVOKE DELETE ON TABLE classes FROM educore_platform;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_migrator') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE classes TO educore_migrator;
  END IF;
END
$$;

REVOKE ALL ON TABLE classes FROM PUBLIC;

SELECT app.enable_tenant_rls('classes'::regclass);

CREATE POLICY rls_classes_select ON classes
  FOR SELECT TO educore_app
  USING (tenant_id = app.current_tenant_id());

CREATE POLICY rls_classes_select_platform ON classes
  FOR SELECT TO educore_platform
  USING (app.is_trusted_platform_session());

CREATE POLICY rls_classes_insert_platform ON classes
  FOR INSERT TO educore_platform
  WITH CHECK (app.is_trusted_platform_session());

CREATE POLICY rls_classes_update_platform ON classes
  FOR UPDATE TO educore_platform
  USING (app.is_trusted_platform_session())
  WITH CHECK (app.is_trusted_platform_session());
