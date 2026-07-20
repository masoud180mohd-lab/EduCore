-- IMP-002 P0 / DBF-002: students table + student.read permission for GET /api/v1/students.
-- educore_app is SELECT-only. No student write HTTP in this slice.

CREATE TABLE students (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  student_code text NULL,
  display_name text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_students_display_name_len CHECK (char_length(display_name) BETWEEN 1 AND 200),
  CONSTRAINT ck_students_status CHECK (
    status IN ('active', 'inactive', 'graduated', 'transferred', 'draft')
  ),
  CONSTRAINT ck_students_code_format CHECK (
    student_code IS NULL OR student_code ~ '^[A-Za-z0-9._-]{1,64}$'
  )
);

COMMENT ON TABLE students IS
  'Student Registry: tenant-owned student directory row (list-read slice DBF-002).';

CREATE UNIQUE INDEX uq_students_tenant_code
  ON students (tenant_id, student_code)
  WHERE student_code IS NOT NULL;

CREATE INDEX ix_students_tenant_status ON students (tenant_id, status);
CREATE INDEX ix_students_tenant_display_name ON students (tenant_id, display_name);

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT SELECT ON TABLE students TO educore_app;
    REVOKE INSERT, UPDATE, DELETE ON TABLE students FROM educore_app;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_platform') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE students TO educore_platform;
    REVOKE DELETE ON TABLE students FROM educore_platform;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_migrator') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE students TO educore_migrator;
  END IF;
END
$$;

REVOKE ALL ON TABLE students FROM PUBLIC;

SELECT app.enable_tenant_rls('students'::regclass);

CREATE POLICY rls_students_select ON students
  FOR SELECT TO educore_app
  USING (tenant_id = app.current_tenant_id());

CREATE POLICY rls_students_select_platform ON students
  FOR SELECT TO educore_platform
  USING (app.is_trusted_platform_session());

CREATE POLICY rls_students_insert_platform ON students
  FOR INSERT TO educore_platform
  WITH CHECK (app.is_trusted_platform_session());

CREATE POLICY rls_students_update_platform ON students
  FOR UPDATE TO educore_platform
  USING (app.is_trusted_platform_session())
  WITH CHECK (app.is_trusted_platform_session());

-- Permission catalog + grants onto existing system roles
INSERT INTO permissions (id, code, description) VALUES
  (
    '01900000-0001-7000-8000-00000000000e',
    'student.read',
    'List and view students in tenant'
  )
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, now()
FROM roles r
CROSS JOIN permissions p
WHERE r.is_system = true
  AND r.code IN ('owner', 'admin', 'staff')
  AND p.code = 'student.read'
ON CONFLICT DO NOTHING;
