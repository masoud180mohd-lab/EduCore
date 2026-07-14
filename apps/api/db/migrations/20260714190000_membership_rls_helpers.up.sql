-- IMP-001 P1 continuation: real membership helpers + RLS for tenant_memberships.
-- SECURITY DEFINER on membership lookups avoids RLS recursion with can_see_* policies.

SELECT app.enable_tenant_rls('tenant_memberships'::regclass);

-- ---------------------------------------------------------------------------
-- Membership lookup (bypasses RLS safely as table owner / superuser-owned fn)
-- ---------------------------------------------------------------------------

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

CREATE OR REPLACE FUNCTION app.user_is_member_of_current_tenant(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
  IF target_user_id IS NULL OR app.current_tenant_id() IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM tenant_memberships m
    WHERE m.tenant_id = app.current_tenant_id()
      AND m.user_id = target_user_id
      AND m.status = 'active'
  );
END;
$$;

COMMENT ON FUNCTION app.user_is_member_of_current_tenant(uuid) IS
  'True when target user is an active member of app.current_tenant. SECURITY DEFINER.';

-- Rebind can_see_user to include same-tenant active members (Pattern C complete).
CREATE OR REPLACE FUNCTION app.can_see_user(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT target_user_id IS NOT NULL
    AND (
      target_user_id = app.current_user_id()
      OR app.is_trusted_platform_session()
      OR app.user_is_member_of_current_tenant(target_user_id)
    );
$$;

COMMENT ON FUNCTION app.can_see_user(uuid) IS
  'Pattern C: self, trusted platform, or active member of current tenant.';

-- can_see_tenant already calls user_has_active_membership (from 170000 / 160000).
-- Re-assert trusted platform + membership composition for clarity.
CREATE OR REPLACE FUNCTION app.can_see_tenant(target_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT target_tenant_id IS NOT NULL
    AND (
      target_tenant_id = app.current_tenant_id()
      OR app.is_trusted_platform_session()
      OR app.user_has_active_membership(target_tenant_id)
    );
$$;

COMMENT ON FUNCTION app.can_see_tenant(uuid) IS
  'Pattern B: current tenant GUC, trusted platform session, or active membership.';

-- ---------------------------------------------------------------------------
-- Policies on tenant_memberships (avoid calling can_see_tenant → no recursion)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS rls_tenant_memberships_select ON tenant_memberships;
CREATE POLICY rls_tenant_memberships_select
  ON tenant_memberships
  FOR SELECT
  TO educore_app
  USING (
    tenant_id = app.current_tenant_id()
    OR user_id = app.current_user_id()
  );

DROP POLICY IF EXISTS rls_tenant_memberships_select_platform ON tenant_memberships;
CREATE POLICY rls_tenant_memberships_select_platform
  ON tenant_memberships
  FOR SELECT
  TO educore_platform
  USING (app.is_trusted_platform_session());

DROP POLICY IF EXISTS rls_tenant_memberships_insert_platform ON tenant_memberships;
CREATE POLICY rls_tenant_memberships_insert_platform
  ON tenant_memberships
  FOR INSERT
  TO educore_platform
  WITH CHECK (app.is_trusted_platform_session());

DROP POLICY IF EXISTS rls_tenant_memberships_update ON tenant_memberships;
CREATE POLICY rls_tenant_memberships_update
  ON tenant_memberships
  FOR UPDATE
  TO educore_app
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS rls_tenant_memberships_update_platform ON tenant_memberships;
CREATE POLICY rls_tenant_memberships_update_platform
  ON tenant_memberships
  FOR UPDATE
  TO educore_platform
  USING (app.is_trusted_platform_session())
  WITH CHECK (app.is_trusted_platform_session());

-- No DELETE policies for runtime roles → deny by default.

GRANT USAGE ON SCHEMA app TO educore_app;
GRANT USAGE ON SCHEMA app TO educore_platform;
GRANT EXECUTE ON FUNCTION app.user_has_active_membership(uuid) TO educore_app;
GRANT EXECUTE ON FUNCTION app.user_has_active_membership(uuid) TO educore_platform;
GRANT EXECUTE ON FUNCTION app.user_is_member_of_current_tenant(uuid) TO educore_app;
GRANT EXECUTE ON FUNCTION app.user_is_member_of_current_tenant(uuid) TO educore_platform;
GRANT EXECUTE ON FUNCTION app.can_see_user(uuid) TO educore_app;
GRANT EXECUTE ON FUNCTION app.can_see_user(uuid) TO educore_platform;
GRANT EXECUTE ON FUNCTION app.can_see_tenant(uuid) TO educore_app;
GRANT EXECUTE ON FUNCTION app.can_see_tenant(uuid) TO educore_platform;
