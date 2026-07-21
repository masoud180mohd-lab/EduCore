-- IMP-005-A0 / DBF-009: attendance_sessions + attendance_records (SELECT-only for educore_app).
-- Permissions: attendance.read + attendance.manage (staff gets both).

CREATE TABLE attendance_sessions (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  class_id uuid NOT NULL REFERENCES classes (id),
  stream_id uuid NULL REFERENCES streams (id),
  academic_year_id uuid NOT NULL REFERENCES academic_years (id),
  term_id uuid NULL REFERENCES terms (id),
  session_date date NOT NULL,
  status text NOT NULL,
  notes text NULL,
  created_by_user_id uuid NULL REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_attendance_sessions_status CHECK (status IN ('open', 'closed')),
  CONSTRAINT ck_attendance_sessions_notes_len CHECK (
    notes IS NULL OR char_length(notes) <= 500
  )
);

COMMENT ON TABLE attendance_sessions IS
  'Attendance: one session for a class (+ optional stream) on a date (DBF-009).';

CREATE UNIQUE INDEX uq_attendance_sessions_class_stream_date
  ON attendance_sessions (
    tenant_id,
    class_id,
    COALESCE(stream_id, '00000000-0000-0000-0000-000000000000'::uuid),
    session_date
  );

CREATE INDEX ix_attendance_sessions_tenant_date
  ON attendance_sessions (tenant_id, session_date DESC, id ASC);

CREATE INDEX ix_attendance_sessions_tenant_class
  ON attendance_sessions (tenant_id, class_id, session_date DESC);

CREATE TABLE attendance_records (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  session_id uuid NOT NULL REFERENCES attendance_sessions (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students (id),
  status text NOT NULL,
  note text NULL,
  marked_at timestamptz NOT NULL DEFAULT now(),
  marked_by_user_id uuid NULL REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_attendance_records_status CHECK (
    status IN ('present', 'absent', 'late', 'excused')
  ),
  CONSTRAINT ck_attendance_records_note_len CHECK (
    note IS NULL OR char_length(note) <= 500
  ),
  CONSTRAINT uq_attendance_records_session_student UNIQUE (session_id, student_id)
);

COMMENT ON TABLE attendance_records IS
  'Attendance: per-student mark within a session (DBF-009).';

CREATE INDEX ix_attendance_records_tenant_session
  ON attendance_records (tenant_id, session_id);

CREATE INDEX ix_attendance_records_tenant_student
  ON attendance_records (tenant_id, student_id);

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT SELECT ON TABLE attendance_sessions TO educore_app;
    GRANT SELECT ON TABLE attendance_records TO educore_app;
    REVOKE INSERT, UPDATE, DELETE ON TABLE attendance_sessions FROM educore_app;
    REVOKE INSERT, UPDATE, DELETE ON TABLE attendance_records FROM educore_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_platform') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE attendance_sessions TO educore_platform;
    GRANT SELECT, INSERT, UPDATE ON TABLE attendance_records TO educore_platform;
    REVOKE DELETE ON TABLE attendance_sessions FROM educore_platform;
    REVOKE DELETE ON TABLE attendance_records FROM educore_platform;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_migrator') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE attendance_sessions TO educore_migrator;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE attendance_records TO educore_migrator;
  END IF;
END
$$;

REVOKE ALL ON TABLE attendance_sessions FROM PUBLIC;
REVOKE ALL ON TABLE attendance_records FROM PUBLIC;

SELECT app.enable_tenant_rls('attendance_sessions'::regclass);
SELECT app.enable_tenant_rls('attendance_records'::regclass);

CREATE POLICY rls_attendance_sessions_select ON attendance_sessions
  FOR SELECT TO educore_app USING (tenant_id = app.current_tenant_id());
CREATE POLICY rls_attendance_sessions_select_platform ON attendance_sessions
  FOR SELECT TO educore_platform USING (app.is_trusted_platform_session());
CREATE POLICY rls_attendance_sessions_insert_platform ON attendance_sessions
  FOR INSERT TO educore_platform WITH CHECK (app.is_trusted_platform_session());
CREATE POLICY rls_attendance_sessions_update_platform ON attendance_sessions
  FOR UPDATE TO educore_platform
  USING (app.is_trusted_platform_session())
  WITH CHECK (app.is_trusted_platform_session());

CREATE POLICY rls_attendance_records_select ON attendance_records
  FOR SELECT TO educore_app USING (tenant_id = app.current_tenant_id());
CREATE POLICY rls_attendance_records_select_platform ON attendance_records
  FOR SELECT TO educore_platform USING (app.is_trusted_platform_session());
CREATE POLICY rls_attendance_records_insert_platform ON attendance_records
  FOR INSERT TO educore_platform WITH CHECK (app.is_trusted_platform_session());
CREATE POLICY rls_attendance_records_update_platform ON attendance_records
  FOR UPDATE TO educore_platform
  USING (app.is_trusted_platform_session())
  WITH CHECK (app.is_trusted_platform_session());

INSERT INTO permissions (id, code, description) VALUES
  (
    '01900000-0001-7000-8000-000000000012',
    'attendance.read',
    'List and view attendance sessions and records'
  ),
  (
    '01900000-0001-7000-8000-000000000013',
    'attendance.manage',
    'Create sessions, mark attendance, close sessions'
  )
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, now()
FROM roles r
CROSS JOIN permissions p
WHERE r.is_system = true
  AND r.code IN ('owner', 'admin', 'staff')
  AND p.code IN ('attendance.read', 'attendance.manage')
ON CONFLICT DO NOTHING;
