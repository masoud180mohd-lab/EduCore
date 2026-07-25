-- IMP-018 / DBF-008 rev 1.3: Partial PATCH helper for enrollment status and/or placement.
-- Re-derives academic_year_id / term_id from class when class changes.
-- Table UPDATE remains REVOKED for educore_app.

CREATE OR REPLACE FUNCTION app.patch_enrollment(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_enrollment_id uuid,
  p_set_class boolean,
  p_class_id uuid,
  p_set_stream boolean,
  p_stream_id uuid,
  p_set_status boolean,
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
  v_class_id uuid;
  v_stream_id uuid;
  v_year_id uuid;
  v_term_id uuid;
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_enrollment_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT COALESCE(p_set_class, false)
     AND NOT COALESCE(p_set_stream, false)
     AND NOT COALESCE(p_set_status, false) THEN
    RAISE EXCEPTION 'no fields to update' USING ERRCODE = '22023';
  END IF;
  IF p_set_status THEN
    IF p_status IS NULL OR p_status NOT IN ('active', 'withdrawn', 'completed', 'suspended') THEN
      RAISE EXCEPTION 'invalid status' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;

  SELECT e.class_id, e.stream_id, e.academic_year_id, e.term_id
  INTO v_class_id, v_stream_id, v_year_id, v_term_id
  FROM enrollments e
  WHERE e.id = p_enrollment_id AND e.tenant_id = p_tenant_id;

  IF v_class_id IS NULL THEN
    RETURN;
  END IF;

  IF p_set_class THEN
    IF p_class_id IS NULL THEN
      RAISE EXCEPTION 'invalid class' USING ERRCODE = '22023';
    END IF;
    SELECT c.academic_year_id, c.term_id
    INTO v_year_id, v_term_id
    FROM classes c
    WHERE c.id = p_class_id AND c.tenant_id = p_tenant_id;
    IF v_year_id IS NULL THEN
      RAISE EXCEPTION 'class not found' USING ERRCODE = '22023';
    END IF;
    v_class_id := p_class_id;
    -- Class change without explicit stream → clear stream (may not belong to new class).
    IF NOT p_set_stream THEN
      v_stream_id := NULL;
    END IF;
  END IF;

  IF p_set_stream THEN
    IF p_stream_id IS NULL THEN
      v_stream_id := NULL;
    ELSE
      IF NOT EXISTS (
        SELECT 1 FROM streams st
        WHERE st.id = p_stream_id
          AND st.tenant_id = p_tenant_id
          AND st.class_id = v_class_id
      ) THEN
        RAISE EXCEPTION 'stream not found' USING ERRCODE = '22023';
      END IF;
      v_stream_id := p_stream_id;
    END IF;
  END IF;

  UPDATE enrollments e
  SET
    class_id = v_class_id,
    stream_id = v_stream_id,
    academic_year_id = v_year_id,
    term_id = v_term_id,
    status = CASE WHEN p_set_status THEN p_status ELSE e.status END,
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

COMMENT ON FUNCTION app.patch_enrollment(
  uuid, uuid, uuid, boolean, uuid, boolean, uuid, boolean, text
) IS
  'IMP-018: Partial enrollment PATCH (status and/or class/stream). Year/term from class.';

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT EXECUTE ON FUNCTION app.patch_enrollment(
      uuid, uuid, uuid, boolean, uuid, boolean, uuid, boolean, text
    ) TO educore_app;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION app.patch_enrollment(
  uuid, uuid, uuid, boolean, uuid, boolean, uuid, boolean, text
) FROM PUBLIC;
