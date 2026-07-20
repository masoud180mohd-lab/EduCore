-- IMP-002-P2 / DBF-002 rev 1.1: create_student helper + student.manage permission.
-- Table INSERT remains REVOKED for educore_app; product write via SECURITY DEFINER only.

CREATE OR REPLACE FUNCTION app.create_student(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_student_id uuid,
  p_student_code text,
  p_display_name text,
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
  IF p_display_name IS NULL
     OR char_length(btrim(p_display_name)) < 1
     OR char_length(btrim(p_display_name)) > 200 THEN
    RAISE EXCEPTION 'invalid display_name' USING ERRCODE = '22023';
  END IF;
  IF p_status IS NULL
     OR p_status NOT IN ('active', 'inactive', 'graduated', 'transferred', 'draft') THEN
    RAISE EXCEPTION 'invalid status' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;

  INSERT INTO students (
    id, tenant_id, student_code, display_name, status, created_at, updated_at
  ) VALUES (
    p_student_id,
    p_tenant_id,
    NULLIF(btrim(COALESCE(p_student_code, '')), ''),
    btrim(p_display_name),
    p_status,
    now(),
    now()
  );

  RETURN QUERY
  SELECT s.id, s.tenant_id, s.student_code, s.display_name, s.status,
         s.created_at, s.updated_at
  FROM students s
  WHERE s.id = p_student_id;
END;
$$;

COMMENT ON FUNCTION app.create_student(uuid, uuid, uuid, text, text, text) IS
  'P2: Insert student in bound tenant. SECURITY DEFINER; active membership required.';

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT EXECUTE ON FUNCTION app.create_student(uuid, uuid, uuid, text, text, text) TO educore_app;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION app.create_student(uuid, uuid, uuid, text, text, text) FROM PUBLIC;

INSERT INTO permissions (id, code, description) VALUES
  (
    '01900000-0001-7000-8000-00000000000f',
    'student.manage',
    'Create and manage students in tenant (create only in IMP-002-P2)'
  )
ON CONFLICT (code) DO NOTHING;

-- owner + admin only (not staff)
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, now()
FROM roles r
CROSS JOIN permissions p
WHERE r.is_system = true
  AND r.code IN ('owner', 'admin')
  AND p.code = 'student.manage'
ON CONFLICT DO NOTHING;
