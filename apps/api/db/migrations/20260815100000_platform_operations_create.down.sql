-- Rollback DBF-PLAT-001 platform-layer tables and restore prior membership check.

CREATE OR REPLACE FUNCTION app.user_has_active_membership(target_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
  IF target_tenant_id IS NULL OR app.current_user_id() IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM tenant_memberships m
    WHERE m.tenant_id = target_tenant_id
      AND m.user_id = app.current_user_id()
      AND m.status = 'active'
  );
END;
$$;

COMMENT ON FUNCTION app.user_has_active_membership(uuid) IS
  'True when current_user has active membership in target tenant. SECURITY DEFINER (no RLS recursion).';

DROP TABLE IF EXISTS audit_events;
DROP TABLE IF EXISTS tenant_entitlements;
DROP TABLE IF EXISTS tenant_plan_assignments;
DROP TABLE IF EXISTS platform_operators;
