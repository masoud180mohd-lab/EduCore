-- IMP-003-P2 / DBF-003 write path: create_academic_year helper + academic.manage.
-- Table INSERT remains REVOKED for educore_app; product write via SECURITY DEFINER only.

CREATE OR REPLACE FUNCTION app.create_academic_year(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_year_id uuid,
  p_name text,
  p_code text,
  p_starts_on date,
  p_ends_on date,
  p_status text
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
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
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_year_id IS NULL THEN
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

  INSERT INTO academic_years (
    id, tenant_id, name, code, starts_on, ends_on, status, created_at, updated_at
  ) VALUES (
    p_year_id,
    p_tenant_id,
    btrim(p_name),
    NULLIF(btrim(COALESCE(p_code, '')), ''),
    p_starts_on,
    p_ends_on,
    p_status,
    now(),
    now()
  );

  RETURN QUERY
  SELECT y.id, y.tenant_id, y.name, y.code, y.starts_on, y.ends_on, y.status,
         y.created_at, y.updated_at
  FROM academic_years y
  WHERE y.id = p_year_id;
END;
$$;

COMMENT ON FUNCTION app.create_academic_year(uuid, uuid, uuid, text, text, date, date, text) IS
  'P2: Insert academic year in bound tenant. SECURITY DEFINER; active membership required.';

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT EXECUTE ON FUNCTION app.create_academic_year(
      uuid, uuid, uuid, text, text, date, date, text
    ) TO educore_app;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION app.create_academic_year(
  uuid, uuid, uuid, text, text, date, date, text
) FROM PUBLIC;

INSERT INTO permissions (id, code, description) VALUES
  (
    '01900000-0001-7000-8000-000000000011',
    'academic.manage',
    'Create and manage academic structure (create year only in IMP-003-P2)'
  )
ON CONFLICT (code) DO NOTHING;

-- owner + admin only (not staff)
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, now()
FROM roles r
CROSS JOIN permissions p
WHERE r.is_system = true
  AND r.code IN ('owner', 'admin')
  AND p.code = 'academic.manage'
ON CONFLICT DO NOTHING;
