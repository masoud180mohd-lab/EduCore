-- IMP-003-P5 / DBF-004 rev 1.1: app.create_term helper.
-- Table INSERT remains REVOKED for educore_app; product write via SECURITY DEFINER only.
-- Permission academic.manage already seeded (years P2); no new permission codes.

CREATE OR REPLACE FUNCTION app.create_term(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_term_id uuid,
  p_academic_year_id uuid,
  p_name text,
  p_code text,
  p_starts_on date,
  p_ends_on date,
  p_status text
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
BEGIN
  IF p_actor_user_id IS NULL
     OR p_tenant_id IS NULL
     OR p_term_id IS NULL
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
  IF p_starts_on IS NOT NULL AND p_ends_on IS NOT NULL AND p_ends_on < p_starts_on THEN
    RAISE EXCEPTION 'ends_on before starts_on' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;

  -- Parent year must exist in the bound tenant (cross-tenant year → same error).
  IF NOT EXISTS (
    SELECT 1
    FROM academic_years y
    WHERE y.id = p_academic_year_id
      AND y.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'parent academic year not found' USING ERRCODE = '22023';
  END IF;

  INSERT INTO terms (
    id,
    tenant_id,
    academic_year_id,
    name,
    code,
    starts_on,
    ends_on,
    status,
    created_at,
    updated_at
  ) VALUES (
    p_term_id,
    p_tenant_id,
    p_academic_year_id,
    btrim(p_name),
    NULLIF(btrim(COALESCE(p_code, '')), ''),
    p_starts_on,
    p_ends_on,
    p_status,
    now(),
    now()
  );

  RETURN QUERY
  SELECT t.id, t.tenant_id, t.academic_year_id, t.name, t.code,
         t.starts_on, t.ends_on, t.status, t.created_at, t.updated_at
  FROM terms t
  WHERE t.id = p_term_id;
END;
$$;

COMMENT ON FUNCTION app.create_term(uuid, uuid, uuid, uuid, text, text, date, date, text) IS
  'P5: Insert term under academic year in bound tenant. SECURITY DEFINER; active membership + parent year tenant check.';

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT EXECUTE ON FUNCTION app.create_term(
      uuid, uuid, uuid, uuid, text, text, date, date, text
    ) TO educore_app;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION app.create_term(
  uuid, uuid, uuid, uuid, text, text, date, date, text
) FROM PUBLIC;
