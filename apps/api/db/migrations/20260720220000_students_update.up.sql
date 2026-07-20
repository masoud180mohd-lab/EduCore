-- IMP-002-P3 / DBF-002 rev 1.2: app.update_student helper.
-- Table UPDATE remains REVOKED for educore_app; product write via SECURITY DEFINER only.

CREATE OR REPLACE FUNCTION app.update_student(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_student_id uuid,
  p_set_display_name boolean,
  p_display_name text,
  p_set_student_code boolean,
  p_student_code text,
  p_set_status boolean,
  p_status text
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  student_code text,
  display_name text,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_student_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT COALESCE(p_set_display_name, false)
     AND NOT COALESCE(p_set_student_code, false)
     AND NOT COALESCE(p_set_status, false) THEN
    RAISE EXCEPTION 'no fields to update' USING ERRCODE = '22023';
  END IF;
  IF p_set_display_name THEN
    IF p_display_name IS NULL
       OR char_length(btrim(p_display_name)) < 1
       OR char_length(btrim(p_display_name)) > 200 THEN
      RAISE EXCEPTION 'invalid display_name' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF p_set_status THEN
    IF p_status IS NULL
       OR p_status NOT IN ('active', 'inactive', 'graduated', 'transferred', 'draft') THEN
      RAISE EXCEPTION 'invalid status' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;

  -- Bound tenant only; missing / other-tenant → empty result (app maps 404).
  IF NOT EXISTS (
    SELECT 1
    FROM students s
    WHERE s.id = p_student_id
      AND s.tenant_id = p_tenant_id
  ) THEN
    RETURN;
  END IF;

  UPDATE students s
  SET
    display_name = CASE
      WHEN p_set_display_name THEN btrim(p_display_name)
      ELSE s.display_name
    END,
    student_code = CASE
      WHEN p_set_student_code THEN NULLIF(btrim(COALESCE(p_student_code, '')), '')
      ELSE s.student_code
    END,
    status = CASE
      WHEN p_set_status THEN p_status
      ELSE s.status
    END,
    updated_at = now()
  WHERE s.id = p_student_id
    AND s.tenant_id = p_tenant_id;

  RETURN QUERY
  SELECT s.id, s.tenant_id, s.student_code, s.display_name, s.status,
         s.created_at, s.updated_at
  FROM students s
  WHERE s.id = p_student_id
    AND s.tenant_id = p_tenant_id;
END;
$$;

COMMENT ON FUNCTION app.update_student(
  uuid, uuid, uuid, boolean, text, boolean, text, boolean, text
) IS
  'P3: Partial update student in bound tenant. SECURITY DEFINER; active membership; empty if missing.';

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT EXECUTE ON FUNCTION app.update_student(
      uuid, uuid, uuid, boolean, text, boolean, text, boolean, text
    ) TO educore_app;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION app.update_student(
  uuid, uuid, uuid, boolean, text, boolean, text, boolean, text
) FROM PUBLIC;
