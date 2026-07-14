DROP POLICY IF EXISTS rls_tenant_memberships_update_platform ON tenant_memberships;
DROP POLICY IF EXISTS rls_tenant_memberships_update ON tenant_memberships;
DROP POLICY IF EXISTS rls_tenant_memberships_insert_platform ON tenant_memberships;
DROP POLICY IF EXISTS rls_tenant_memberships_select_platform ON tenant_memberships;
DROP POLICY IF EXISTS rls_tenant_memberships_select ON tenant_memberships;

-- Restore stub membership helper (pre-membership table behaviour).
CREATE OR REPLACE FUNCTION app.user_has_active_membership(target_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT false
    AND target_tenant_id IS NOT NULL
    AND app.current_user_id() IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION app.can_see_user(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT target_user_id IS NOT NULL
    AND (
      target_user_id = app.current_user_id()
      OR app.is_trusted_platform_session()
    );
$$;

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

DROP FUNCTION IF EXISTS app.user_is_member_of_current_tenant(uuid);
