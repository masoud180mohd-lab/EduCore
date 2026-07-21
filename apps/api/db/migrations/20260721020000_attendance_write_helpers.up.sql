-- IMP-005 write helpers: create/close session + upsert records.
-- Table DML remains revoked for educore_app.

CREATE OR REPLACE FUNCTION app.create_attendance_session(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_session_id uuid,
  p_class_id uuid,
  p_stream_id uuid,
  p_session_date date,
  p_notes text
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  class_id uuid,
  stream_id uuid,
  academic_year_id uuid,
  term_id uuid,
  session_date date,
  status text,
  notes text,
  created_by_user_id uuid,
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
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_session_id IS NULL
     OR p_class_id IS NULL OR p_session_date IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
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
      WHERE st.id = p_stream_id AND st.tenant_id = p_tenant_id AND st.class_id = p_class_id
    ) THEN
      RAISE EXCEPTION 'stream not found' USING ERRCODE = '22023';
    END IF;
  END IF;

  INSERT INTO attendance_sessions (
    id, tenant_id, class_id, stream_id, academic_year_id, term_id,
    session_date, status, notes, created_by_user_id, created_at, updated_at
  ) VALUES (
    p_session_id, p_tenant_id, p_class_id, p_stream_id, v_year_id, v_term_id,
    p_session_date, 'open', NULLIF(btrim(COALESCE(p_notes, '')), ''), p_actor_user_id,
    now(), now()
  );

  RETURN QUERY
  SELECT s.id, s.tenant_id, s.class_id, s.stream_id, s.academic_year_id, s.term_id,
         s.session_date, s.status, s.notes, s.created_by_user_id, s.created_at, s.updated_at
  FROM attendance_sessions s WHERE s.id = p_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.close_attendance_session(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_session_id uuid
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  class_id uuid,
  stream_id uuid,
  academic_year_id uuid,
  term_id uuid,
  session_date date,
  status text,
  notes text,
  created_by_user_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  v_status text;
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_session_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;

  SELECT s.status INTO v_status
  FROM attendance_sessions s
  WHERE s.id = p_session_id AND s.tenant_id = p_tenant_id;

  IF v_status IS NULL THEN
    RETURN;
  END IF;
  IF v_status = 'closed' THEN
    RAISE EXCEPTION 'session already closed' USING ERRCODE = 'P0001';
  END IF;

  UPDATE attendance_sessions s
  SET status = 'closed', updated_at = now()
  WHERE s.id = p_session_id AND s.tenant_id = p_tenant_id;

  RETURN QUERY
  SELECT s.id, s.tenant_id, s.class_id, s.stream_id, s.academic_year_id, s.term_id,
         s.session_date, s.status, s.notes, s.created_by_user_id, s.created_at, s.updated_at
  FROM attendance_sessions s WHERE s.id = p_session_id;
END;
$$;

-- Upsert one record; called in a loop from app for bulk (or use single-row from Nest).
CREATE OR REPLACE FUNCTION app.upsert_attendance_record(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_record_id uuid,
  p_session_id uuid,
  p_student_id uuid,
  p_status text,
  p_note text
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  session_id uuid,
  student_id uuid,
  status text,
  note text,
  marked_at timestamptz,
  marked_by_user_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  v_class_id uuid;
  v_stream_id uuid;
  v_sess_status text;
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_record_id IS NULL
     OR p_session_id IS NULL OR p_student_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('present', 'absent', 'late', 'excused') THEN
    RAISE EXCEPTION 'invalid status' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;

  SELECT s.class_id, s.stream_id, s.status
  INTO v_class_id, v_stream_id, v_sess_status
  FROM attendance_sessions s
  WHERE s.id = p_session_id AND s.tenant_id = p_tenant_id;

  IF v_class_id IS NULL THEN
    RAISE EXCEPTION 'session not found' USING ERRCODE = '22023';
  END IF;
  IF v_sess_status = 'closed' THEN
    RAISE EXCEPTION 'session closed' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM enrollments e
    WHERE e.tenant_id = p_tenant_id
      AND e.student_id = p_student_id
      AND e.class_id = v_class_id
      AND e.status = 'active'
      AND (v_stream_id IS NULL OR e.stream_id IS NULL OR e.stream_id = v_stream_id)
  ) THEN
    RAISE EXCEPTION 'student not enrolled' USING ERRCODE = '22023';
  END IF;

  INSERT INTO attendance_records (
    id, tenant_id, session_id, student_id, status, note,
    marked_at, marked_by_user_id, created_at, updated_at
  ) VALUES (
    p_record_id, p_tenant_id, p_session_id, p_student_id, p_status,
    NULLIF(btrim(COALESCE(p_note, '')), ''),
    now(), p_actor_user_id, now(), now()
  )
  ON CONFLICT (session_id, student_id) DO UPDATE
    SET status = EXCLUDED.status,
        note = EXCLUDED.note,
        marked_at = now(),
        marked_by_user_id = p_actor_user_id,
        updated_at = now();

  RETURN QUERY
  SELECT r.id, r.tenant_id, r.session_id, r.student_id, r.status, r.note,
         r.marked_at, r.marked_by_user_id, r.created_at, r.updated_at
  FROM attendance_records r
  WHERE r.session_id = p_session_id AND r.student_id = p_student_id;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT EXECUTE ON FUNCTION app.create_attendance_session(
      uuid, uuid, uuid, uuid, uuid, date, text
    ) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.close_attendance_session(uuid, uuid, uuid) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.upsert_attendance_record(
      uuid, uuid, uuid, uuid, uuid, text, text
    ) TO educore_app;
  END IF;
END $$;

REVOKE ALL ON FUNCTION app.create_attendance_session(uuid, uuid, uuid, uuid, uuid, date, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.close_attendance_session(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.upsert_attendance_record(uuid, uuid, uuid, uuid, uuid, text, text) FROM PUBLIC;
