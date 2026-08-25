-- Student portal bind (SPEC-PORTALS Phase 4a / DSF-009).
-- students.user_id + student system role + student.self.read + bind helpers.

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS user_id uuid NULL REFERENCES users (id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_students_tenant_user_id
  ON students (tenant_id, user_id)
  WHERE user_id IS NOT NULL;

COMMENT ON COLUMN students.user_id IS
  'DSF-009: optional portal bind to users.id (one student per user per tenant).';

INSERT INTO permissions (id, code, description) VALUES
  (
    '01900000-0001-7000-8000-000000000052',
    'student.self.read',
    'Read own bound student profile (student portal)'
  )
ON CONFLICT (code) DO NOTHING;

INSERT INTO roles (id, tenant_id, code, name, is_system, created_at, updated_at)
SELECT gen_random_uuid(), t.id, 'student', 'Student', true, now(), now()
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM roles r WHERE r.tenant_id = t.id AND r.code = 'student'
);

INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, now()
FROM roles r
CROSS JOIN permissions p
WHERE r.is_system = true
  AND (
    (r.code = 'student' AND p.code = 'student.self.read')
    OR (r.code IN ('owner', 'admin') AND p.code = 'student.self.read')
  )
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION app.assign_system_role_codes(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_target_user_id uuid,
  p_role_codes text[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  v_code text;
  v_role_id uuid;
  v_assigned integer := 0;
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;
  IF p_role_codes IS NULL OR cardinality(p_role_codes) = 0 THEN
    RETURN 0;
  END IF;

  FOREACH v_code IN ARRAY p_role_codes
  LOOP
    IF v_code IS NULL OR btrim(v_code) = '' THEN
      CONTINUE;
    END IF;
    IF v_code NOT IN ('owner', 'admin', 'staff', 'bursar', 'parent', 'student') THEN
      RAISE EXCEPTION 'invalid role code: %', v_code USING ERRCODE = '22023';
    END IF;

    SELECT r.id INTO v_role_id
    FROM roles r
    WHERE r.tenant_id = p_tenant_id
      AND r.code = v_code
      AND r.is_system = true
    LIMIT 1;

    IF v_role_id IS NULL THEN
      RAISE EXCEPTION 'system role not found for tenant: %', v_code USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO user_roles (id, tenant_id, user_id, role_id, created_at)
    VALUES (gen_random_uuid(), p_tenant_id, p_target_user_id, v_role_id, now())
    ON CONFLICT DO NOTHING;

    v_assigned := v_assigned + 1;
  END LOOP;

  RETURN v_assigned;
END;
$$;

COMMENT ON FUNCTION app.assign_system_role_codes(uuid, uuid, uuid, text[]) IS
  'Assign system role codes (owner/admin/staff/bursar/parent/student). SECURITY DEFINER; educore_app has no direct RBAC writes.';

CREATE OR REPLACE FUNCTION app.bind_student_user(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_student_id uuid,
  p_user_id uuid
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  student_code text,
  display_name text,
  status text,
  user_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  v_existing uuid;
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_student_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;
  IF NOT app.auth_has_active_membership(p_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'target user must have active membership' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM students s
    WHERE s.id = p_student_id AND s.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'student not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT s.user_id INTO v_existing
  FROM students s
  WHERE s.id = p_student_id AND s.tenant_id = p_tenant_id;

  IF v_existing IS NOT NULL AND v_existing <> p_user_id THEN
    RAISE EXCEPTION 'student already bound' USING ERRCODE = '23505';
  END IF;

  IF EXISTS (
    SELECT 1 FROM students s
    WHERE s.tenant_id = p_tenant_id
      AND s.user_id = p_user_id
      AND s.id <> p_student_id
  ) THEN
    RAISE EXCEPTION 'user already bound to another student' USING ERRCODE = '23505';
  END IF;

  UPDATE students s
  SET user_id = p_user_id, updated_at = now()
  WHERE s.id = p_student_id AND s.tenant_id = p_tenant_id;

  PERFORM app.assign_system_role_codes(
    p_actor_user_id, p_tenant_id, p_user_id, ARRAY['student']::text[]
  );

  RETURN QUERY
  SELECT s.id, s.tenant_id, s.student_code, s.display_name, s.status, s.user_id,
         s.created_at, s.updated_at
  FROM students s WHERE s.id = p_student_id AND s.tenant_id = p_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.unbind_student_user(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_student_id uuid
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  student_code text,
  display_name text,
  status text,
  user_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  v_bound uuid;
  v_student_role uuid;
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_student_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;

  SELECT s.user_id INTO v_bound
  FROM students s
  WHERE s.id = p_student_id AND s.tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'student not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE students s
  SET user_id = NULL, updated_at = now()
  WHERE s.id = p_student_id AND s.tenant_id = p_tenant_id;

  IF v_bound IS NOT NULL THEN
    SELECT r.id INTO v_student_role
    FROM roles r
    WHERE r.tenant_id = p_tenant_id AND r.code = 'student' AND r.is_system = true
    LIMIT 1;

    IF v_student_role IS NOT NULL THEN
      DELETE FROM user_roles ur
      WHERE ur.tenant_id = p_tenant_id
        AND ur.user_id = v_bound
        AND ur.role_id = v_student_role
        AND ur.organization_id IS NULL;
    END IF;
  END IF;

  RETURN QUERY
  SELECT s.id, s.tenant_id, s.student_code, s.display_name, s.status, s.user_id,
         s.created_at, s.updated_at
  FROM students s WHERE s.id = p_student_id AND s.tenant_id = p_tenant_id;
END;
$$;

COMMENT ON FUNCTION app.bind_student_user(uuid, uuid, uuid, uuid) IS
  'DSF-009: bind user to student + assign student role.';
COMMENT ON FUNCTION app.unbind_student_user(uuid, uuid, uuid) IS
  'DSF-009: clear student user bind + remove student role only.';

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT EXECUTE ON FUNCTION app.bind_student_user(uuid, uuid, uuid, uuid) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.unbind_student_user(uuid, uuid, uuid) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.assign_system_role_codes(uuid, uuid, uuid, text[]) TO educore_app;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION app.bind_student_user(uuid, uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.unbind_student_user(uuid, uuid, uuid) FROM PUBLIC;
