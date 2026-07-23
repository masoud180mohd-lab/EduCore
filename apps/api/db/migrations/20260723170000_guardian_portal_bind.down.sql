-- Down: IMP-011-PX guardian portal bind

DROP FUNCTION IF EXISTS app.unbind_guardian_user(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS app.bind_guardian_user(uuid, uuid, uuid, uuid);

-- Restore assign_system_role_codes without parent (pre-PX)
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
    IF v_code NOT IN ('owner', 'admin', 'staff') THEN
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

DELETE FROM role_permissions rp
USING permissions p, roles r
WHERE rp.permission_id = p.id
  AND rp.role_id = r.id
  AND p.code IN ('parent.guardian.read', 'parent.finance.read');

DELETE FROM user_roles ur
USING roles r
WHERE ur.role_id = r.id AND r.code = 'parent' AND r.is_system = true;

DELETE FROM roles WHERE code = 'parent' AND is_system = true;

DELETE FROM permissions
WHERE code IN ('parent.guardian.read', 'parent.finance.read');

DROP INDEX IF EXISTS uq_guardians_tenant_user_id;
ALTER TABLE guardians DROP COLUMN IF EXISTS user_id;
