-- IMP-014: DELETE helpers (empty-only, 409 on dependents) and reparent
-- extensions to app.update_term / app.update_class / app.update_stream.
-- Table DELETE/UPDATE remain REVOKED for educore_app; product access via
-- SECURITY DEFINER helpers only.

-- =====================================================================
-- A) Delete helpers
-- =====================================================================

CREATE OR REPLACE FUNCTION app.delete_academic_year(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM academic_years y WHERE y.id = p_id AND y.tenant_id = p_tenant_id
  ) THEN
    RETURN false;
  END IF;

  IF EXISTS (
      SELECT 1 FROM terms t WHERE t.academic_year_id = p_id AND t.tenant_id = p_tenant_id
    )
    OR EXISTS (
      SELECT 1 FROM classes c WHERE c.academic_year_id = p_id AND c.tenant_id = p_tenant_id
    )
    OR EXISTS (
      SELECT 1 FROM enrollments e WHERE e.academic_year_id = p_id AND e.tenant_id = p_tenant_id
    )
    OR EXISTS (
      SELECT 1 FROM attendance_sessions s
      WHERE s.academic_year_id = p_id AND s.tenant_id = p_tenant_id
    )
    OR EXISTS (
      SELECT 1 FROM exams x WHERE x.academic_year_id = p_id AND x.tenant_id = p_tenant_id
    )
    OR EXISTS (
      SELECT 1 FROM fee_structures f WHERE f.academic_year_id = p_id AND f.tenant_id = p_tenant_id
    )
    OR EXISTS (
      SELECT 1 FROM invoices i WHERE i.academic_year_id = p_id AND i.tenant_id = p_tenant_id
    )
  THEN
    RAISE EXCEPTION 'has dependents' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM academic_years y WHERE y.id = p_id AND y.tenant_id = p_tenant_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION app.delete_term(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM terms t WHERE t.id = p_id AND t.tenant_id = p_tenant_id
  ) THEN
    RETURN false;
  END IF;

  IF EXISTS (
      SELECT 1 FROM classes c WHERE c.term_id = p_id AND c.tenant_id = p_tenant_id
    )
    OR EXISTS (
      SELECT 1 FROM enrollments e WHERE e.term_id = p_id AND e.tenant_id = p_tenant_id
    )
    OR EXISTS (
      SELECT 1 FROM attendance_sessions s WHERE s.term_id = p_id AND s.tenant_id = p_tenant_id
    )
    OR EXISTS (
      SELECT 1 FROM exams x WHERE x.term_id = p_id AND x.tenant_id = p_tenant_id
    )
  THEN
    RAISE EXCEPTION 'has dependents' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM terms t WHERE t.id = p_id AND t.tenant_id = p_tenant_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION app.delete_class(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM classes c WHERE c.id = p_id AND c.tenant_id = p_tenant_id
  ) THEN
    RETURN false;
  END IF;

  IF EXISTS (
      SELECT 1 FROM streams s WHERE s.class_id = p_id AND s.tenant_id = p_tenant_id
    )
    OR EXISTS (
      SELECT 1 FROM enrollments e WHERE e.class_id = p_id AND e.tenant_id = p_tenant_id
    )
    OR EXISTS (
      SELECT 1 FROM attendance_sessions a WHERE a.class_id = p_id AND a.tenant_id = p_tenant_id
    )
    OR EXISTS (
      SELECT 1 FROM exams x WHERE x.class_id = p_id AND x.tenant_id = p_tenant_id
    )
  THEN
    RAISE EXCEPTION 'has dependents' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM classes c WHERE c.id = p_id AND c.tenant_id = p_tenant_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION app.delete_stream(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM streams s WHERE s.id = p_id AND s.tenant_id = p_tenant_id
  ) THEN
    RETURN false;
  END IF;

  IF EXISTS (
      SELECT 1 FROM enrollments e WHERE e.stream_id = p_id AND e.tenant_id = p_tenant_id
    )
    OR EXISTS (
      SELECT 1 FROM attendance_sessions a WHERE a.stream_id = p_id AND a.tenant_id = p_tenant_id
    )
  THEN
    RAISE EXCEPTION 'has dependents' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM streams s WHERE s.id = p_id AND s.tenant_id = p_tenant_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION app.delete_subject(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM subjects s WHERE s.id = p_id AND s.tenant_id = p_tenant_id
  ) THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1 FROM exam_subjects es WHERE es.subject_id = p_id AND es.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'has dependents' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM subjects s WHERE s.id = p_id AND s.tenant_id = p_tenant_id;
  RETURN true;
END;
$$;

-- =====================================================================
-- B) Reparent — extend app.update_term / app.update_class / app.update_stream
-- =====================================================================

DROP FUNCTION IF EXISTS app.update_term(
  uuid, uuid, uuid, boolean, text, boolean, text, boolean, date, boolean, date, boolean, text
);
DROP FUNCTION IF EXISTS app.update_class(uuid, uuid, uuid, boolean, text, boolean, text, boolean, text);
DROP FUNCTION IF EXISTS app.update_stream(uuid, uuid, uuid, boolean, text, boolean, text, boolean, text);

CREATE OR REPLACE FUNCTION app.update_term(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_term_id uuid,
  p_set_name boolean,
  p_name text,
  p_set_code boolean,
  p_code text,
  p_set_starts_on boolean,
  p_starts_on date,
  p_set_ends_on boolean,
  p_ends_on date,
  p_set_status boolean,
  p_status text,
  p_set_academic_year_id boolean,
  p_academic_year_id uuid
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  academic_year_id uuid,
  name text,
  code text,
  starts_on date,
  ends_on date,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  v_starts date;
  v_ends date;
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_term_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT COALESCE(p_set_name, false)
     AND NOT COALESCE(p_set_code, false)
     AND NOT COALESCE(p_set_starts_on, false)
     AND NOT COALESCE(p_set_ends_on, false)
     AND NOT COALESCE(p_set_status, false)
     AND NOT COALESCE(p_set_academic_year_id, false) THEN
    RAISE EXCEPTION 'no fields to update' USING ERRCODE = '22023';
  END IF;
  IF p_set_name THEN
    IF p_name IS NULL OR char_length(btrim(p_name)) < 1 OR char_length(btrim(p_name)) > 200 THEN
      RAISE EXCEPTION 'invalid name' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF p_set_status THEN
    IF p_status IS NULL OR p_status NOT IN ('draft', 'active', 'closed') THEN
      RAISE EXCEPTION 'invalid status' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM terms t WHERE t.id = p_term_id AND t.tenant_id = p_tenant_id
  ) THEN
    RETURN;
  END IF;

  IF p_set_academic_year_id THEN
    IF p_academic_year_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM academic_years y WHERE y.id = p_academic_year_id AND y.tenant_id = p_tenant_id
    ) THEN
      RAISE EXCEPTION 'academicYearId not found in this tenant' USING ERRCODE = '22023';
    END IF;
  END IF;

  SELECT t.starts_on, t.ends_on INTO v_starts, v_ends
  FROM terms t WHERE t.id = p_term_id AND t.tenant_id = p_tenant_id;
  IF p_set_starts_on THEN v_starts := p_starts_on; END IF;
  IF p_set_ends_on THEN v_ends := p_ends_on; END IF;
  IF v_starts IS NOT NULL AND v_ends IS NOT NULL AND v_ends < v_starts THEN
    RAISE EXCEPTION 'ends_on before starts_on' USING ERRCODE = '22023';
  END IF;

  UPDATE terms t
  SET
    name = CASE WHEN p_set_name THEN btrim(p_name) ELSE t.name END,
    code = CASE
      WHEN p_set_code THEN NULLIF(btrim(COALESCE(p_code, '')), '')
      ELSE t.code
    END,
    starts_on = CASE WHEN p_set_starts_on THEN p_starts_on ELSE t.starts_on END,
    ends_on = CASE WHEN p_set_ends_on THEN p_ends_on ELSE t.ends_on END,
    status = CASE WHEN p_set_status THEN p_status ELSE t.status END,
    academic_year_id = CASE
      WHEN p_set_academic_year_id THEN p_academic_year_id
      ELSE t.academic_year_id
    END,
    updated_at = now()
  WHERE t.id = p_term_id AND t.tenant_id = p_tenant_id;

  RETURN QUERY
  SELECT t.id, t.tenant_id, t.academic_year_id, t.name, t.code, t.starts_on, t.ends_on,
         t.status, t.created_at, t.updated_at
  FROM terms t
  WHERE t.id = p_term_id AND t.tenant_id = p_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.update_class(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_class_id uuid,
  p_set_name boolean,
  p_name text,
  p_set_code boolean,
  p_code text,
  p_set_status boolean,
  p_status text,
  p_set_academic_year_id boolean,
  p_academic_year_id uuid,
  p_set_term_id boolean,
  p_term_id uuid
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  academic_year_id uuid,
  term_id uuid,
  name text,
  code text,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  v_year_id uuid;
  v_term_year_id uuid;
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_class_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT COALESCE(p_set_name, false)
     AND NOT COALESCE(p_set_code, false)
     AND NOT COALESCE(p_set_status, false)
     AND NOT COALESCE(p_set_academic_year_id, false)
     AND NOT COALESCE(p_set_term_id, false) THEN
    RAISE EXCEPTION 'no fields to update' USING ERRCODE = '22023';
  END IF;
  IF p_set_name THEN
    IF p_name IS NULL OR char_length(btrim(p_name)) < 1 OR char_length(btrim(p_name)) > 200 THEN
      RAISE EXCEPTION 'invalid name' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF p_set_status THEN
    IF p_status IS NULL OR p_status NOT IN ('draft', 'active', 'closed') THEN
      RAISE EXCEPTION 'invalid status' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;

  SELECT c.academic_year_id INTO v_year_id
  FROM classes c WHERE c.id = p_class_id AND c.tenant_id = p_tenant_id;
  IF v_year_id IS NULL THEN
    RETURN;
  END IF;

  IF p_set_academic_year_id THEN
    IF p_academic_year_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM academic_years y WHERE y.id = p_academic_year_id AND y.tenant_id = p_tenant_id
    ) THEN
      RAISE EXCEPTION 'academicYearId not found in this tenant' USING ERRCODE = '22023';
    END IF;
    v_year_id := p_academic_year_id;
  END IF;

  IF p_set_term_id AND p_term_id IS NOT NULL THEN
    SELECT t.academic_year_id INTO v_term_year_id
    FROM terms t WHERE t.id = p_term_id AND t.tenant_id = p_tenant_id;
    IF v_term_year_id IS NULL THEN
      RAISE EXCEPTION 'termId not found in this tenant' USING ERRCODE = '22023';
    END IF;
    IF v_term_year_id <> v_year_id THEN
      RAISE EXCEPTION 'termId not in academic year' USING ERRCODE = '22023';
    END IF;
  END IF;

  UPDATE classes c
  SET
    name = CASE WHEN p_set_name THEN btrim(p_name) ELSE c.name END,
    code = CASE
      WHEN p_set_code THEN NULLIF(btrim(COALESCE(p_code, '')), '')
      ELSE c.code
    END,
    status = CASE WHEN p_set_status THEN p_status ELSE c.status END,
    academic_year_id = CASE
      WHEN p_set_academic_year_id THEN p_academic_year_id
      ELSE c.academic_year_id
    END,
    term_id = CASE WHEN p_set_term_id THEN p_term_id ELSE c.term_id END,
    updated_at = now()
  WHERE c.id = p_class_id AND c.tenant_id = p_tenant_id;

  RETURN QUERY
  SELECT c.id, c.tenant_id, c.academic_year_id, c.term_id, c.name, c.code, c.status,
         c.created_at, c.updated_at
  FROM classes c
  WHERE c.id = p_class_id AND c.tenant_id = p_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.update_stream(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_stream_id uuid,
  p_set_name boolean,
  p_name text,
  p_set_code boolean,
  p_code text,
  p_set_status boolean,
  p_status text,
  p_set_class_id boolean,
  p_class_id uuid
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  class_id uuid,
  name text,
  code text,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_stream_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT COALESCE(p_set_name, false)
     AND NOT COALESCE(p_set_code, false)
     AND NOT COALESCE(p_set_status, false)
     AND NOT COALESCE(p_set_class_id, false) THEN
    RAISE EXCEPTION 'no fields to update' USING ERRCODE = '22023';
  END IF;
  IF p_set_name THEN
    IF p_name IS NULL OR char_length(btrim(p_name)) < 1 OR char_length(btrim(p_name)) > 200 THEN
      RAISE EXCEPTION 'invalid name' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF p_set_status THEN
    IF p_status IS NULL OR p_status NOT IN ('draft', 'active', 'closed') THEN
      RAISE EXCEPTION 'invalid status' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM streams s WHERE s.id = p_stream_id AND s.tenant_id = p_tenant_id
  ) THEN
    RETURN;
  END IF;

  IF p_set_class_id THEN
    IF p_class_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM classes c WHERE c.id = p_class_id AND c.tenant_id = p_tenant_id
    ) THEN
      RAISE EXCEPTION 'classId not found in this tenant' USING ERRCODE = '22023';
    END IF;
  END IF;

  UPDATE streams s
  SET
    name = CASE WHEN p_set_name THEN btrim(p_name) ELSE s.name END,
    code = CASE
      WHEN p_set_code THEN NULLIF(btrim(COALESCE(p_code, '')), '')
      ELSE s.code
    END,
    status = CASE WHEN p_set_status THEN p_status ELSE s.status END,
    class_id = CASE WHEN p_set_class_id THEN p_class_id ELSE s.class_id END,
    updated_at = now()
  WHERE s.id = p_stream_id AND s.tenant_id = p_tenant_id;

  RETURN QUERY
  SELECT s.id, s.tenant_id, s.class_id, s.name, s.code, s.status, s.created_at, s.updated_at
  FROM streams s
  WHERE s.id = p_stream_id AND s.tenant_id = p_tenant_id;
END;
$$;

-- =====================================================================
-- Comments
-- =====================================================================

COMMENT ON FUNCTION app.delete_academic_year(uuid, uuid, uuid) IS
  'IMP-014: Delete academic year if empty. SECURITY DEFINER; false if missing; P0001 if dependents.';

COMMENT ON FUNCTION app.delete_term(uuid, uuid, uuid) IS
  'IMP-014: Delete term if empty. SECURITY DEFINER; false if missing; P0001 if dependents.';

COMMENT ON FUNCTION app.delete_class(uuid, uuid, uuid) IS
  'IMP-014: Delete class if empty. SECURITY DEFINER; false if missing; P0001 if dependents.';

COMMENT ON FUNCTION app.delete_stream(uuid, uuid, uuid) IS
  'IMP-014: Delete stream if empty. SECURITY DEFINER; false if missing; P0001 if dependents.';

COMMENT ON FUNCTION app.delete_subject(uuid, uuid, uuid) IS
  'IMP-014: Delete subject if empty. SECURITY DEFINER; false if missing; P0001 if dependents.';

COMMENT ON FUNCTION app.update_term(
  uuid, uuid, uuid, boolean, text, boolean, text, boolean, date, boolean, date, boolean, text,
  boolean, uuid
) IS 'IMP-014: Partial update + reparent term (academicYearId). SECURITY DEFINER; empty if missing.';

COMMENT ON FUNCTION app.update_class(
  uuid, uuid, uuid, boolean, text, boolean, text, boolean, text, boolean, uuid, boolean, uuid
) IS 'IMP-014: Partial update + reparent class (academicYearId/termId). SECURITY DEFINER; empty if missing.';

COMMENT ON FUNCTION app.update_stream(
  uuid, uuid, uuid, boolean, text, boolean, text, boolean, text, boolean, uuid
) IS 'IMP-014: Partial update + reparent stream (classId). SECURITY DEFINER; empty if missing.';

-- =====================================================================
-- C) Grants
-- =====================================================================

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT EXECUTE ON FUNCTION app.delete_academic_year(uuid, uuid, uuid) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.delete_term(uuid, uuid, uuid) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.delete_class(uuid, uuid, uuid) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.delete_stream(uuid, uuid, uuid) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.delete_subject(uuid, uuid, uuid) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.update_term(
      uuid, uuid, uuid, boolean, text, boolean, text, boolean, date, boolean, date, boolean, text,
      boolean, uuid
    ) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.update_class(
      uuid, uuid, uuid, boolean, text, boolean, text, boolean, text, boolean, uuid, boolean, uuid
    ) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.update_stream(
      uuid, uuid, uuid, boolean, text, boolean, text, boolean, text, boolean, uuid
    ) TO educore_app;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION app.delete_academic_year(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.delete_term(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.delete_class(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.delete_stream(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.delete_subject(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.update_term(
  uuid, uuid, uuid, boolean, text, boolean, text, boolean, date, boolean, date, boolean, text,
  boolean, uuid
) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.update_class(
  uuid, uuid, uuid, boolean, text, boolean, text, boolean, text, boolean, uuid, boolean, uuid
) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.update_stream(
  uuid, uuid, uuid, boolean, text, boolean, text, boolean, text, boolean, uuid
) FROM PUBLIC;
