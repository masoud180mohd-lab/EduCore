-- IMP-008 write helpers for exams / exam_subjects / marks.

CREATE OR REPLACE FUNCTION app.create_exam(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_exam_id uuid,
  p_name text,
  p_academic_year_id uuid,
  p_term_id uuid,
  p_class_id uuid,
  p_status text
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  name text,
  academic_year_id uuid,
  term_id uuid,
  class_id uuid,
  status text,
  created_by_user_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_exam_id IS NULL
     OR p_name IS NULL OR p_academic_year_id IS NULL OR p_class_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF char_length(btrim(p_name)) < 1 OR char_length(btrim(p_name)) > 200 THEN
    RAISE EXCEPTION 'invalid name' USING ERRCODE = '22023';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('draft', 'open', 'closed') THEN
    RAISE EXCEPTION 'invalid status' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM academic_years y
    WHERE y.id = p_academic_year_id AND y.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'academic year not found' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM classes c
    WHERE c.id = p_class_id AND c.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'class not found' USING ERRCODE = '22023';
  END IF;
  IF p_term_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM terms t
    WHERE t.id = p_term_id AND t.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'term not found' USING ERRCODE = '22023';
  END IF;

  INSERT INTO exams (
    id, tenant_id, name, academic_year_id, term_id, class_id, status,
    created_by_user_id, created_at, updated_at
  ) VALUES (
    p_exam_id, p_tenant_id, btrim(p_name), p_academic_year_id, p_term_id, p_class_id,
    p_status, p_actor_user_id, now(), now()
  );

  RETURN QUERY
  SELECT e.id, e.tenant_id, e.name, e.academic_year_id, e.term_id, e.class_id, e.status,
         e.created_by_user_id, e.created_at, e.updated_at
  FROM exams e WHERE e.id = p_exam_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.create_exam_subject(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_exam_subject_id uuid,
  p_exam_id uuid,
  p_subject_id uuid,
  p_max_score numeric
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  exam_id uuid,
  subject_id uuid,
  max_score numeric,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_exam_subject_id IS NULL
     OR p_exam_id IS NULL OR p_subject_id IS NULL OR p_max_score IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF p_max_score <= 0 OR p_max_score > 9999.99 THEN
    RAISE EXCEPTION 'invalid max_score' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM exams e WHERE e.id = p_exam_id AND e.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'exam not found' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM subjects s WHERE s.id = p_subject_id AND s.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'subject not found' USING ERRCODE = '22023';
  END IF;

  INSERT INTO exam_subjects (
    id, tenant_id, exam_id, subject_id, max_score, status, created_at, updated_at
  ) VALUES (
    p_exam_subject_id, p_tenant_id, p_exam_id, p_subject_id, p_max_score, 'draft', now(), now()
  );

  RETURN QUERY
  SELECT es.id, es.tenant_id, es.exam_id, es.subject_id, es.max_score, es.status,
         es.created_at, es.updated_at
  FROM exam_subjects es WHERE es.id = p_exam_subject_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.upsert_marks(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_exam_subject_id uuid,
  p_records jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  v_class_id uuid;
  v_max numeric;
  v_status text;
  r jsonb;
  v_student_id uuid;
  v_score numeric;
  v_note text;
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_exam_subject_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;

  SELECT es.max_score, es.status, e.class_id
  INTO v_max, v_status, v_class_id
  FROM exam_subjects es
  JOIN exams e ON e.id = es.exam_id
  WHERE es.id = p_exam_subject_id AND es.tenant_id = p_tenant_id;

  IF v_class_id IS NULL THEN
    RAISE EXCEPTION 'exam subject not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'exam subject not editable' USING ERRCODE = '55000';
  END IF;

  IF p_records IS NULL OR jsonb_typeof(p_records) <> 'array' THEN
    RAISE EXCEPTION 'invalid records' USING ERRCODE = '22023';
  END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(p_records)
  LOOP
    v_student_id := (r->>'studentId')::uuid;
    IF v_student_id IS NULL THEN
      RAISE EXCEPTION 'invalid studentId' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM enrollments en
      WHERE en.tenant_id = p_tenant_id
        AND en.student_id = v_student_id
        AND en.class_id = v_class_id
        AND en.status = 'active'
    ) THEN
      RAISE EXCEPTION 'student not enrolled' USING ERRCODE = '22023';
    END IF;

    IF r ? 'score' AND r->>'score' IS NOT NULL AND r->>'score' <> '' THEN
      v_score := (r->>'score')::numeric;
      IF v_score < 0 OR v_score > v_max THEN
        RAISE EXCEPTION 'score out of range' USING ERRCODE = '22023';
      END IF;
    ELSE
      v_score := NULL;
    END IF;

    v_note := NULLIF(btrim(COALESCE(r->>'note', '')), '');

    INSERT INTO marks (
      id, tenant_id, exam_subject_id, student_id, score, note, marked_by_user_id,
      created_at, updated_at
    ) VALUES (
      gen_random_uuid(), p_tenant_id, p_exam_subject_id, v_student_id, v_score, v_note,
      p_actor_user_id, now(), now()
    )
    ON CONFLICT (exam_subject_id, student_id) DO UPDATE SET
      score = EXCLUDED.score,
      note = EXCLUDED.note,
      marked_by_user_id = p_actor_user_id,
      updated_at = now();
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION app.set_exam_subject_status(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_exam_subject_id uuid,
  p_from_status text,
  p_to_status text
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  exam_id uuid,
  subject_id uuid,
  max_score numeric,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_exam_subject_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;

  UPDATE exam_subjects es SET
    status = p_to_status,
    updated_at = now()
  WHERE es.id = p_exam_subject_id
    AND es.tenant_id = p_tenant_id
    AND es.status = p_from_status;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid status transition' USING ERRCODE = '55000';
  END IF;

  RETURN QUERY
  SELECT es.id, es.tenant_id, es.exam_id, es.subject_id, es.max_score, es.status,
         es.created_at, es.updated_at
  FROM exam_subjects es WHERE es.id = p_exam_subject_id;
END;
$$;

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT EXECUTE ON FUNCTION app.create_exam(
      uuid, uuid, uuid, text, uuid, uuid, uuid, text
    ) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.create_exam_subject(
      uuid, uuid, uuid, uuid, uuid, numeric
    ) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.upsert_marks(uuid, uuid, uuid, jsonb) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.set_exam_subject_status(
      uuid, uuid, uuid, text, text
    ) TO educore_app;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION app.create_exam(uuid, uuid, uuid, text, uuid, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.create_exam_subject(uuid, uuid, uuid, uuid, uuid, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.upsert_marks(uuid, uuid, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.set_exam_subject_status(uuid, uuid, uuid, text, text) FROM PUBLIC;
