-- F-004: classroom staff must not hold bursar money permissions.
-- Insert bursar system role, grant office-fees codes, revoke finance.* from staff.
-- Does not auto-assign bursar to existing staff (owner/admin still have finance.manage).

INSERT INTO roles (id, tenant_id, code, name, is_system, created_at, updated_at)
SELECT gen_random_uuid(), t.id, 'bursar', 'Bursar', true, now(), now()
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM roles r WHERE r.tenant_id = t.id AND r.code = 'bursar'
);

INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, now()
FROM roles r
CROSS JOIN permissions p
WHERE r.is_system = true
  AND r.code = 'bursar'
  AND p.code IN (
    'tenant.read',
    'organization.read',
    'student.read',
    'academic.read',
    'guardian.read',
    'finance.read',
    'finance.manage'
  )
ON CONFLICT DO NOTHING;

DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.is_system = true
  AND r.code = 'staff'
  AND p.code IN ('finance.read', 'finance.manage');

CREATE OR REPLACE FUNCTION app.assign_system_role_codes(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_target_user_id uuid,
  p_role_codes text[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  v_code text;
  v_role_id uuid;
  v_assigned integer := 0;
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;
  IF p_role_codes IS NULL OR cardinality(p_role_codes) = 0 THEN
    RETURN 0;
  END IF;

  FOREACH v_code IN ARRAY p_role_codes
  LOOP
    IF v_code IS NULL OR btrim(v_code) = '' THEN
      CONTINUE;
    END IF;
    IF v_code NOT IN ('owner', 'admin', 'staff', 'bursar', 'parent') THEN
      RAISE EXCEPTION 'invalid role code: %', v_code USING ERRCODE = '22023';
    END IF;

    SELECT r.id INTO v_role_id
    FROM roles r
    WHERE r.tenant_id = p_tenant_id
      AND r.code = v_code
      AND r.is_system = true
    LIMIT 1;

    IF v_role_id IS NULL THEN
      RAISE EXCEPTION 'system role not found for tenant: %', v_code USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO user_roles (id, tenant_id, user_id, role_id, created_at)
    VALUES (gen_random_uuid(), p_tenant_id, p_target_user_id, v_role_id, now())
    ON CONFLICT DO NOTHING;

    v_assigned := v_assigned + 1;
  END LOOP;

  RETURN v_assigned;
END;
$$;

COMMENT ON FUNCTION app.assign_system_role_codes(uuid, uuid, uuid, text[]) IS
  'Assign system role codes (owner/admin/staff/bursar/parent). SECURITY DEFINER; educore_app has no direct RBAC writes.';
