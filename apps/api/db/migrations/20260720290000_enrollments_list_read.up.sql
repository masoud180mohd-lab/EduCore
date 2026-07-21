-- IMP-004-E0 / DBF-008: enrollments table for list/detail reads.
-- educore_app SELECT-only. Writes via later helpers.

CREATE TABLE enrollments (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  student_id uuid NOT NULL REFERENCES students (id),
  class_id uuid NOT NULL REFERENCES classes (id),
  stream_id uuid NULL REFERENCES streams (id),
  academic_year_id uuid NOT NULL REFERENCES academic_years (id),
  term_id uuid NULL REFERENCES terms (id),
  status text NOT NULL,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_enrollments_status CHECK (
    status IN ('active', 'withdrawn', 'completed', 'suspended')
  )
);

COMMENT ON TABLE enrollments IS
  'Academic Structure: student enrolled in class (optional stream) for a year (DBF-008).';

CREATE INDEX ix_enrollments_tenant_year_status
  ON enrollments (tenant_id, academic_year_id, status);

CREATE INDEX ix_enrollments_tenant_class_status
  ON enrollments (tenant_id, class_id, status);

CREATE INDEX ix_enrollments_tenant_student_status
  ON enrollments (tenant_id, student_id, status);

CREATE UNIQUE INDEX uq_enrollments_active_suspended
  ON enrollments (tenant_id, student_id, class_id, academic_year_id)
  WHERE status IN ('active', 'suspended');

CREATE INDEX ix_enrollments_tenant_created_at
  ON enrollments (tenant_id, created_at ASC, id ASC);

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT SELECT ON TABLE enrollments TO educore_app;
    REVOKE INSERT, UPDATE, DELETE ON TABLE enrollments FROM educore_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_platform') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE enrollments TO educore_platform;
    REVOKE DELETE ON TABLE enrollments FROM educore_platform;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_migrator') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE enrollments TO educore_migrator;
  END IF;
END
$$;

REVOKE ALL ON TABLE enrollments FROM PUBLIC;

SELECT app.enable_tenant_rls('enrollments'::regclass);

CREATE POLICY rls_enrollments_select ON enrollments
  FOR SELECT TO educore_app
  USING (tenant_id = app.current_tenant_id());

CREATE POLICY rls_enrollments_select_platform ON enrollments
  FOR SELECT TO educore_platform
  USING (app.is_trusted_platform_session());

CREATE POLICY rls_enrollments_insert_platform ON enrollments
  FOR INSERT TO educore_platform
  WITH CHECK (app.is_trusted_platform_session());

CREATE POLICY rls_enrollments_update_platform ON enrollments
  FOR UPDATE TO educore_platform
  USING (app.is_trusted_platform_session())
  WITH CHECK (app.is_trusted_platform_session());
