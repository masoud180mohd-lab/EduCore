-- Down: IMP-025 structured academic delete dependency details.
-- Restore the IMP-014 delete helpers with plain P0001 errors.

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
