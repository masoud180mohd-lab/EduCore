-- IMP-007-G1 / DBF-010: guardians + student_guardians (SELECT-only for educore_app).
-- Permissions: guardian.read + guardian.manage.

CREATE TABLE guardians (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  display_name text NOT NULL,
  phone text NULL,
  email text NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_guardians_display_name_len CHECK (char_length(display_name) BETWEEN 1 AND 200),
  CONSTRAINT ck_guardians_phone_len CHECK (phone IS NULL OR char_length(phone) BETWEEN 1 AND 32),
  CONSTRAINT ck_guardians_email_len CHECK (email IS NULL OR char_length(email) BETWEEN 3 AND 320),
  CONSTRAINT ck_guardians_status CHECK (status IN ('active', 'inactive'))
);

COMMENT ON TABLE guardians IS
  'Student Registry: tenant-owned guardian directory (DBF-010).';

CREATE UNIQUE INDEX uq_guardians_tenant_email
  ON guardians (tenant_id, email)
  WHERE email IS NOT NULL;

CREATE INDEX ix_guardians_tenant_status ON guardians (tenant_id, status);
CREATE INDEX ix_guardians_tenant_display_name ON guardians (tenant_id, display_name);

CREATE TABLE student_guardians (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  student_id uuid NOT NULL REFERENCES students (id),
  guardian_id uuid NOT NULL REFERENCES guardians (id),
  relationship_type text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_student_guardians_relationship CHECK (
    relationship_type IN ('mother', 'father', 'guardian', 'other')
  ),
  CONSTRAINT ck_student_guardians_status CHECK (status IN ('active', 'ended'))
);

COMMENT ON TABLE student_guardians IS
  'Student Registry: link between student and guardian (DBF-010).';

CREATE UNIQUE INDEX uq_student_guardians_active_link
  ON student_guardians (tenant_id, student_id, guardian_id)
  WHERE status = 'active';

CREATE INDEX ix_student_guardians_tenant_guardian
  ON student_guardians (tenant_id, guardian_id);

CREATE INDEX ix_student_guardians_tenant_student
  ON student_guardians (tenant_id, student_id);

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT SELECT ON TABLE guardians TO educore_app;
    GRANT SELECT ON TABLE student_guardians TO educore_app;
    REVOKE INSERT, UPDATE, DELETE ON TABLE guardians FROM educore_app;
    REVOKE INSERT, UPDATE, DELETE ON TABLE student_guardians FROM educore_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_platform') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE guardians TO educore_platform;
    GRANT SELECT, INSERT, UPDATE ON TABLE student_guardians TO educore_platform;
    REVOKE DELETE ON TABLE guardians FROM educore_platform;
    REVOKE DELETE ON TABLE student_guardians FROM educore_platform;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_migrator') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE guardians TO educore_migrator;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE student_guardians TO educore_migrator;
  END IF;
END
$$;

REVOKE ALL ON TABLE guardians FROM PUBLIC;
REVOKE ALL ON TABLE student_guardians FROM PUBLIC;

SELECT app.enable_tenant_rls('guardians'::regclass);
SELECT app.enable_tenant_rls('student_guardians'::regclass);

CREATE POLICY rls_guardians_select ON guardians
  FOR SELECT TO educore_app USING (tenant_id = app.current_tenant_id());
CREATE POLICY rls_guardians_select_platform ON guardians
  FOR SELECT TO educore_platform USING (app.is_trusted_platform_session());

CREATE POLICY rls_student_guardians_select ON student_guardians
  FOR SELECT TO educore_app USING (tenant_id = app.current_tenant_id());
CREATE POLICY rls_student_guardians_select_platform ON student_guardians
  FOR SELECT TO educore_platform USING (app.is_trusted_platform_session());

INSERT INTO permissions (id, code, description) VALUES
  (
    '01900000-0001-7000-8000-000000000020',
    'guardian.read',
    'List and view guardians and student-guardian links'
  ),
  (
    '01900000-0001-7000-8000-000000000021',
    'guardian.manage',
    'Create/update guardians and manage student-guardian links'
  )
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, now()
FROM roles r
CROSS JOIN permissions p
WHERE r.is_system = true
  AND (
    (r.code IN ('owner', 'admin', 'staff') AND p.code = 'guardian.read')
    OR (r.code IN ('owner', 'admin') AND p.code = 'guardian.manage')
  )
ON CONFLICT DO NOTHING;
