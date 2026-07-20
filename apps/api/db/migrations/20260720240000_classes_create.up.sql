-- IMP-003-C2 / DBF-005 write path: app.create_class helper.
-- Table INSERT remains REVOKED for educore_app.

CREATE OR REPLACE FUNCTION app.create_class(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_class_id uuid,
  p_academic_year_id uuid,
  p_term_id uuid,
  p_name text,
  p_code text,
  p_status text
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
BEGIN
  IF p_actor_user_id IS NULL
     OR p_tenant_id IS NULL
     OR p_class_id IS NULL
     OR p_academic_year_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF p_name IS NULL
     OR char_length(btrim(p_name)) < 1
     OR char_length(btrim(p_name)) > 200 THEN
    RAISE EXCEPTION 'invalid name' USING ERRCODE = '22023';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('draft', 'active', 'closed') THEN
    RAISE EXCEPTION 'invalid status' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM academic_years y
    WHERE y.id = p_academic_year_id
      AND y.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'parent academic year not found' USING ERRCODE = '22023';
  END IF;

  IF p_term_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM terms t
      WHERE t.id = p_term_id
        AND t.tenant_id = p_tenant_id
        AND t.academic_year_id = p_academic_year_id
    ) THEN
      RAISE EXCEPTION 'parent term not found' USING ERRCODE = '22023';
    END IF;
  END IF;

  INSERT INTO classes (
    id, tenant_id, academic_year_id, term_id, name, code, status, created_at, updated_at
  ) VALUES (
    p_class_id,
    p_tenant_id,
    p_academic_year_id,
    p_term_id,
    btrim(p_name),
    NULLIF(btrim(COALESCE(p_code, '')), ''),
    p_status,
    now(),
    now()
  );

  RETURN QUERY
  SELECT c.id, c.tenant_id, c.academic_year_id, c.term_id, c.name, c.code,
         c.status, c.created_at, c.updated_at
  FROM classes c
  WHERE c.id = p_class_id;
END;
$$;

COMMENT ON FUNCTION app.create_class(uuid, uuid, uuid, uuid, uuid, text, text, text) IS
  'C2: Insert class under year (optional term) in bound tenant. SECURITY DEFINER.';

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT EXECUTE ON FUNCTION app.create_class(
      uuid, uuid, uuid, uuid, uuid, text, text, text
    ) TO educore_app;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION app.create_class(
  uuid, uuid, uuid, uuid, uuid, text, text, text
) FROM PUBLIC;
