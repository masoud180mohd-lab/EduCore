-- IMP-008-M1 / DBF-011: exams, exam_subjects, marks + permissions.

CREATE TABLE exams (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  name text NOT NULL,
  academic_year_id uuid NOT NULL REFERENCES academic_years (id),
  term_id uuid NULL REFERENCES terms (id),
  class_id uuid NOT NULL REFERENCES classes (id),
  status text NOT NULL,
  created_by_user_id uuid NULL REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_exams_name_len CHECK (char_length(name) BETWEEN 1 AND 200),
  CONSTRAINT ck_exams_status CHECK (status IN ('draft', 'open', 'closed'))
);

COMMENT ON TABLE exams IS 'Assessment: class-scoped exam (DBF-011).';

CREATE INDEX ix_exams_tenant_status ON exams (tenant_id, status);
CREATE INDEX ix_exams_tenant_class ON exams (tenant_id, class_id);

CREATE TABLE exam_subjects (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  exam_id uuid NOT NULL REFERENCES exams (id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects (id),
  max_score numeric(8, 2) NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_exam_subjects_max_score CHECK (max_score > 0 AND max_score <= 9999.99),
  CONSTRAINT ck_exam_subjects_status CHECK (status IN ('draft', 'submitted', 'approved')),
  CONSTRAINT uq_exam_subjects_exam_subject UNIQUE (exam_id, subject_id)
);

COMMENT ON TABLE exam_subjects IS 'Assessment: subject paper within an exam (DBF-011).';

CREATE INDEX ix_exam_subjects_tenant_exam ON exam_subjects (tenant_id, exam_id);

CREATE TABLE marks (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  exam_subject_id uuid NOT NULL REFERENCES exam_subjects (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students (id),
  score numeric(8, 2) NULL,
  note text NULL,
  marked_by_user_id uuid NULL REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_marks_score_nonneg CHECK (score IS NULL OR score >= 0),
  CONSTRAINT ck_marks_note_len CHECK (note IS NULL OR char_length(note) <= 500),
  CONSTRAINT uq_marks_exam_subject_student UNIQUE (exam_subject_id, student_id)
);

COMMENT ON TABLE marks IS 'Assessment: per-student score for an exam subject (DBF-011).';

CREATE INDEX ix_marks_tenant_exam_subject ON marks (tenant_id, exam_subject_id);
CREATE INDEX ix_marks_tenant_student ON marks (tenant_id, student_id);

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT SELECT ON TABLE exams TO educore_app;
    GRANT SELECT ON TABLE exam_subjects TO educore_app;
    GRANT SELECT ON TABLE marks TO educore_app;
    REVOKE INSERT, UPDATE, DELETE ON TABLE exams FROM educore_app;
    REVOKE INSERT, UPDATE, DELETE ON TABLE exam_subjects FROM educore_app;
    REVOKE INSERT, UPDATE, DELETE ON TABLE marks FROM educore_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_platform') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE exams TO educore_platform;
    GRANT SELECT, INSERT, UPDATE ON TABLE exam_subjects TO educore_platform;
    GRANT SELECT, INSERT, UPDATE ON TABLE marks TO educore_platform;
    REVOKE DELETE ON TABLE exams FROM educore_platform;
    REVOKE DELETE ON TABLE exam_subjects FROM educore_platform;
    REVOKE DELETE ON TABLE marks FROM educore_platform;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_migrator') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE exams TO educore_migrator;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE exam_subjects TO educore_migrator;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE marks TO educore_migrator;
  END IF;
END
$$;

REVOKE ALL ON TABLE exams FROM PUBLIC;
REVOKE ALL ON TABLE exam_subjects FROM PUBLIC;
REVOKE ALL ON TABLE marks FROM PUBLIC;

SELECT app.enable_tenant_rls('exams'::regclass);
SELECT app.enable_tenant_rls('exam_subjects'::regclass);
SELECT app.enable_tenant_rls('marks'::regclass);

CREATE POLICY rls_exams_select ON exams
  FOR SELECT TO educore_app USING (tenant_id = app.current_tenant_id());
CREATE POLICY rls_exams_select_platform ON exams
  FOR SELECT TO educore_platform USING (app.is_trusted_platform_session());

CREATE POLICY rls_exam_subjects_select ON exam_subjects
  FOR SELECT TO educore_app USING (tenant_id = app.current_tenant_id());
CREATE POLICY rls_exam_subjects_select_platform ON exam_subjects
  FOR SELECT TO educore_platform USING (app.is_trusted_platform_session());

CREATE POLICY rls_marks_select ON marks
  FOR SELECT TO educore_app USING (tenant_id = app.current_tenant_id());
CREATE POLICY rls_marks_select_platform ON marks
  FOR SELECT TO educore_platform USING (app.is_trusted_platform_session());

INSERT INTO permissions (id, code, description) VALUES
  (
    '01900000-0001-7000-8000-000000000030',
    'marks.read',
    'List and view exams, exam subjects, and marks'
  ),
  (
    '01900000-0001-7000-8000-000000000031',
    'marks.manage',
    'Create exams/subjects, upsert marks, and submit'
  ),
  (
    '01900000-0001-7000-8000-000000000032',
    'marks.approve',
    'Approve submitted exam-subject marks'
  )
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, now()
FROM roles r
CROSS JOIN permissions p
WHERE r.is_system = true
  AND (
    (r.code IN ('owner', 'admin', 'staff') AND p.code IN ('marks.read', 'marks.manage'))
    OR (r.code IN ('owner', 'admin') AND p.code = 'marks.approve')
  )
ON CONFLICT DO NOTHING;
