-- IMP-004-E3/E4 / DBF-008 rev 1.1–1.2: create + update_status helpers.
-- Table INSERT/UPDATE remain REVOKED for educore_app.

CREATE OR REPLACE FUNCTION app.create_enrollment(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_enrollment_id uuid,
  p_student_id uuid,
  p_class_id uuid,
  p_stream_id uuid,
  p_status text
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  student_id uuid,
  class_id uuid,
  stream_id uuid,
  academic_year_id uuid,
  term_id uuid,
  status text,
  enrolled_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  v_year_id uuid;
  v_term_id uuid;
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_enrollment_id IS NULL
     OR p_student_id IS NULL OR p_class_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('active', 'withdrawn', 'completed', 'suspended') THEN
    RAISE EXCEPTION 'invalid status' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM students s
    WHERE s.id = p_student_id AND s.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'student not found' USING ERRCODE = '22023';
  END IF;

  SELECT c.academic_year_id, c.term_id
  INTO v_year_id, v_term_id
  FROM classes c
  WHERE c.id = p_class_id AND c.tenant_id = p_tenant_id;

  IF v_year_id IS NULL THEN
    RAISE EXCEPTION 'class not found' USING ERRCODE = '22023';
  END IF;

  IF p_stream_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM streams st
      WHERE st.id = p_stream_id
        AND st.tenant_id = p_tenant_id
        AND st.class_id = p_class_id
    ) THEN
      RAISE EXCEPTION 'stream not found' USING ERRCODE = '22023';
    END IF;
  END IF;

  INSERT INTO enrollments (
    id, tenant_id, student_id, class_id, stream_id,
    academic_year_id, term_id, status, enrolled_at, created_at, updated_at
  ) VALUES (
    p_enrollment_id,
    p_tenant_id,
    p_student_id,
    p_class_id,
    p_stream_id,
    v_year_id,
    v_term_id,
    p_status,
    now(),
    now(),
    now()
  );

  RETURN QUERY
  SELECT e.id, e.tenant_id, e.student_id, e.class_id, e.stream_id,
         e.academic_year_id, e.term_id, e.status, e.enrolled_at,
         e.created_at, e.updated_at
  FROM enrollments e
  WHERE e.id = p_enrollment_id;
END;
$$;

COMMENT ON FUNCTION app.create_enrollment(uuid, uuid, uuid, uuid, uuid, uuid, text) IS
  'E3: Create enrollment; derive year/term from class; tenant-bound student/class/stream.';

CREATE OR REPLACE FUNCTION app.update_enrollment_status(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_enrollment_id uuid,
  p_status text
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  student_id uuid,
  class_id uuid,
  stream_id uuid,
  academic_year_id uuid,
  term_id uuid,
  status text,
  enrolled_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_enrollment_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('active', 'withdrawn', 'completed', 'suspended') THEN
    RAISE EXCEPTION 'invalid status' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM enrollments e
    WHERE e.id = p_enrollment_id AND e.tenant_id = p_tenant_id
  ) THEN
    RETURN;
  END IF;

  UPDATE enrollments e
  SET status = p_status,
      updated_at = now()
  WHERE e.id = p_enrollment_id
    AND e.tenant_id = p_tenant_id;

  RETURN QUERY
  SELECT e.id, e.tenant_id, e.student_id, e.class_id, e.stream_id,
         e.academic_year_id, e.term_id, e.status, e.enrolled_at,
         e.created_at, e.updated_at
  FROM enrollments e
  WHERE e.id = p_enrollment_id
    AND e.tenant_id = p_tenant_id;
END;
$$;

COMMENT ON FUNCTION app.update_enrollment_status(uuid, uuid, uuid, text) IS
  'E4: Update enrollment status in bound tenant; empty if missing.';

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT EXECUTE ON FUNCTION app.create_enrollment(
      uuid, uuid, uuid, uuid, uuid, uuid, text
    ) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.update_enrollment_status(
      uuid, uuid, uuid, text
    ) TO educore_app;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION app.create_enrollment(uuid, uuid, uuid, uuid, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.update_enrollment_status(uuid, uuid, uuid, text) FROM PUBLIC;
