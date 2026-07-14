-- IMP-001-T06 / T10 (P1): First RLS policies for tenants + users (DBF-001 Patterns B & C).
-- Membership-based visibility is prepared via app.user_has_active_membership() which
-- returns false until tenant_memberships exists (next increment will replace the body).

-- ---------------------------------------------------------------------------
-- Visibility helpers (membership-ready)
-- Order matters: membership hook first (referenced by can_see_tenant).
-- ---------------------------------------------------------------------------

-- Membership hook: false until tenant_memberships is created; then redefined.
CREATE OR REPLACE FUNCTION app.user_has_active_membership(target_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT false
    AND target_tenant_id IS NOT NULL
    AND app.current_user_id() IS NOT NULL;
$$;

COMMENT ON FUNCTION app.user_has_active_membership(uuid) IS
  'Placeholder returning false until tenant_memberships exists. Do not remove call sites.';

-- True when the actor may see a tenant row (Pattern B core + membership hook).
CREATE OR REPLACE FUNCTION app.can_see_tenant(target_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT target_tenant_id IS NOT NULL
    AND (
      target_tenant_id = app.current_tenant_id()
      OR (
        app.is_platform_operator()
        AND app.rls_mode() IN ('platform', 'bootstrap')
      )
      OR app.user_has_active_membership(target_tenant_id)
    );
$$;

-- True when actor may see a user row (Pattern C interim without memberships).
CREATE OR REPLACE FUNCTION app.can_see_user(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT target_user_id IS NOT NULL
    AND (
      target_user_id = app.current_user_id()
      OR (
        app.is_platform_operator()
        AND app.rls_mode() IN ('platform', 'bootstrap')
      )
      -- Future: OR EXISTS membership linking target_user to app.current_tenant_id()
    );
$$;

COMMENT ON FUNCTION app.can_see_user(uuid) IS
  'Pattern C interim: self or platform. Membership-in-tenant visibility added with tenant_memberships.';

-- ---------------------------------------------------------------------------
-- FORCE RLS on both tables
-- ---------------------------------------------------------------------------

SELECT app.enable_tenant_rls('tenants'::regclass);
SELECT app.enable_tenant_rls('users'::regclass);

-- ---------------------------------------------------------------------------
-- tenants policies (Pattern B)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS rls_tenants_select ON tenants;
CREATE POLICY rls_tenants_select
  ON tenants
  FOR SELECT
  TO educore_app
  USING (app.can_see_tenant(id));

DROP POLICY IF EXISTS rls_tenants_insert ON tenants;
CREATE POLICY rls_tenants_insert
  ON tenants
  FOR INSERT
  TO educore_app
  WITH CHECK (
    app.is_platform_operator()
    OR app.rls_mode() IN ('bootstrap', 'platform')
  );

DROP POLICY IF EXISTS rls_tenants_update ON tenants;
CREATE POLICY rls_tenants_update
  ON tenants
  FOR UPDATE
  TO educore_app
  USING (app.can_see_tenant(id))
  WITH CHECK (app.can_see_tenant(id));

-- No DELETE policy for educore_app → deny by default.

-- ---------------------------------------------------------------------------
-- users policies (Pattern C interim)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS rls_users_select ON users;
CREATE POLICY rls_users_select
  ON users
  FOR SELECT
  TO educore_app
  USING (app.can_see_user(id));

DROP POLICY IF EXISTS rls_users_insert ON users;
CREATE POLICY rls_users_insert
  ON users
  FOR INSERT
  TO educore_app
  WITH CHECK (
    app.is_platform_operator()
    OR app.rls_mode() IN ('bootstrap', 'platform')
    -- Authenticated app paths may create users only when bootstrap/platform GUC set.
  );

DROP POLICY IF EXISTS rls_users_update ON users;
CREATE POLICY rls_users_update
  ON users
  FOR UPDATE
  TO educore_app
  USING (
    id = app.current_user_id()
    OR (
      app.is_platform_operator()
      AND app.rls_mode() IN ('platform', 'bootstrap')
    )
  )
  WITH CHECK (
    id = app.current_user_id()
    OR (
      app.is_platform_operator()
      AND app.rls_mode() IN ('platform', 'bootstrap')
    )
  );

-- No DELETE policy for educore_app → deny by default.

-- Table owner / superuser bypass is expected for migrator connections only.
REVOKE ALL ON TABLE tenants FROM PUBLIC;
REVOKE ALL ON TABLE users FROM PUBLIC;
