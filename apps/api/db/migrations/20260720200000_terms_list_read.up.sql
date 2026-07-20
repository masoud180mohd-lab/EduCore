-- IMP-003 P3 / DBF-004: terms table for GET /api/v1/terms.
-- educore_app is SELECT-only. No term write HTTP in this slice.
-- Permission: reuses academic.read (seeded in academic_years list migration).

CREATE TABLE terms (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  academic_year_id uuid NOT NULL REFERENCES academic_years (id),
  name text NOT NULL,
  code text NULL,
  starts_on date NULL,
  ends_on date NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_terms_name_len CHECK (char_length(name) BETWEEN 1 AND 200),
  CONSTRAINT ck_terms_status CHECK (status IN ('draft', 'active', 'closed')),
  CONSTRAINT ck_terms_code_format CHECK (
    code IS NULL OR code ~ '^[A-Za-z0-9._/-]{1,64}$'
  ),
  CONSTRAINT ck_terms_date_range CHECK (
    starts_on IS NULL OR ends_on IS NULL OR ends_on >= starts_on
  )
);

COMMENT ON TABLE terms IS
  'Academic Structure: tenant-owned term under an academic year (list-read slice DBF-004).';

CREATE UNIQUE INDEX uq_terms_tenant_year_code
  ON terms (tenant_id, academic_year_id, code)
  WHERE code IS NOT NULL;

CREATE INDEX ix_terms_tenant_year_status
  ON terms (tenant_id, academic_year_id, status);

CREATE INDEX ix_terms_tenant_year_starts_on
  ON terms (tenant_id, academic_year_id, starts_on ASC NULLS LAST);

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT SELECT ON TABLE terms TO educore_app;
    REVOKE INSERT, UPDATE, DELETE ON TABLE terms FROM educore_app;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_platform') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE terms TO educore_platform;
    REVOKE DELETE ON TABLE terms FROM educore_platform;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_migrator') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE terms TO educore_migrator;
  END IF;
END
$$;

REVOKE ALL ON TABLE terms FROM PUBLIC;

SELECT app.enable_tenant_rls('terms'::regclass);

CREATE POLICY rls_terms_select ON terms
  FOR SELECT TO educore_app
  USING (tenant_id = app.current_tenant_id());

CREATE POLICY rls_terms_select_platform ON terms
  FOR SELECT TO educore_platform
  USING (app.is_trusted_platform_session());

CREATE POLICY rls_terms_insert_platform ON terms
  FOR INSERT TO educore_platform
  WITH CHECK (app.is_trusted_platform_session());

CREATE POLICY rls_terms_update_platform ON terms
  FOR UPDATE TO educore_platform
  USING (app.is_trusted_platform_session())
  WITH CHECK (app.is_trusted_platform_session());
