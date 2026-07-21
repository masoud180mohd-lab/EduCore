-- IMP-003-J0 / DBF-007: subjects table. educore_app SELECT-only.

CREATE TABLE subjects (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  name text NOT NULL,
  code text NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_subjects_name_len CHECK (char_length(name) BETWEEN 1 AND 200),
  CONSTRAINT ck_subjects_status CHECK (status IN ('draft', 'active', 'closed')),
  CONSTRAINT ck_subjects_code_format CHECK (
    code IS NULL OR code ~ '^[A-Za-z0-9._/-]{1,64}$'
  )
);

COMMENT ON TABLE subjects IS
  'Academic Structure: tenant subject catalogue (DBF-007).';

CREATE UNIQUE INDEX uq_subjects_tenant_code
  ON subjects (tenant_id, code)
  WHERE code IS NOT NULL;

CREATE INDEX ix_subjects_tenant_status ON subjects (tenant_id, status);
CREATE INDEX ix_subjects_tenant_name ON subjects (tenant_id, name ASC);

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT SELECT ON TABLE subjects TO educore_app;
    REVOKE INSERT, UPDATE, DELETE ON TABLE subjects FROM educore_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_platform') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE subjects TO educore_platform;
    REVOKE DELETE ON TABLE subjects FROM educore_platform;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_migrator') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE subjects TO educore_migrator;
  END IF;
END
$$;

REVOKE ALL ON TABLE subjects FROM PUBLIC;
SELECT app.enable_tenant_rls('subjects'::regclass);

CREATE POLICY rls_subjects_select ON subjects
  FOR SELECT TO educore_app USING (tenant_id = app.current_tenant_id());
CREATE POLICY rls_subjects_select_platform ON subjects
  FOR SELECT TO educore_platform USING (app.is_trusted_platform_session());
CREATE POLICY rls_subjects_insert_platform ON subjects
  FOR INSERT TO educore_platform WITH CHECK (app.is_trusted_platform_session());
CREATE POLICY rls_subjects_update_platform ON subjects
  FOR UPDATE TO educore_platform
  USING (app.is_trusted_platform_session())
  WITH CHECK (app.is_trusted_platform_session());
