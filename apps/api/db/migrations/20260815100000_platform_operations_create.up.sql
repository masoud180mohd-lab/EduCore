-- DBF-PLAT-001 (SPEC-PORTALS-001 Phase 1a): platform-layer tables.
-- New: platform_operators, tenant_plan_assignments, tenant_entitlements, audit_events.
-- Also: membership check now requires tenant status = 'active' (ACF-PLAT-001 suspend rule).
--
-- Trust model (AUDIT-R2 preserved): platform writes require the educore_platform DB role
-- AND both privileged GUCs (app.is_trusted_platform_session()). The Nest platform-operations
-- module uses a dedicated narrowly-scoped educore_platform pool (mirrors educore_webhook / F-017).

-- ---------------------------------------------------------------------------
-- platform_operators (global catalog pattern; app-layer guard is the read path)
-- ---------------------------------------------------------------------------

CREATE TABLE platform_operators (
  user_id uuid PRIMARY KEY REFERENCES users (id),
  role text NOT NULL,
  status text NOT NULL,
  granted_by uuid NULL REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_platform_operators_role CHECK (role IN ('super_admin', 'support')),
  CONSTRAINT ck_platform_operators_status CHECK (status IN ('active', 'revoked'))
);

COMMENT ON TABLE platform_operators IS
  'DBF-PLAT-001: global users holding platform capability. Grants tenant lifecycle control only — never tenant data access (32 Explicit Deny). Writes via migrator/ops only in v1.';

-- ---------------------------------------------------------------------------
-- tenant_plan_assignments (history-preserving; one active per tenant)
-- ---------------------------------------------------------------------------

CREATE TABLE tenant_plan_assignments (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  plan_id uuid NOT NULL REFERENCES plans (id),
  status text NOT NULL,
  assigned_by uuid NOT NULL REFERENCES users (id),
  reason text NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz NULL,
  CONSTRAINT ck_tenant_plan_assignments_status CHECK (status IN ('active', 'ended')),
  CONSTRAINT ck_tenant_plan_assignments_reason_len CHECK (char_length(reason) BETWEEN 5 AND 500),
  CONSTRAINT ck_tenant_plan_assignments_ended CHECK (
    (status = 'active' AND ended_at IS NULL) OR (status = 'ended' AND ended_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX uq_tenant_plan_assignments_active
  ON tenant_plan_assignments (tenant_id)
  WHERE status = 'active';

CREATE INDEX ix_tenant_plan_assignments_tenant ON tenant_plan_assignments (tenant_id, assigned_at DESC);

COMMENT ON TABLE tenant_plan_assignments IS
  'DBF-PLAT-001: manual plan assignment history per tenant. Platform-mode writes only.';

-- ---------------------------------------------------------------------------
-- tenant_entitlements (platform-managed feature flags per tenant)
-- ---------------------------------------------------------------------------

CREATE TABLE tenant_entitlements (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  code text NOT NULL,
  enabled boolean NOT NULL,
  limit_value integer NULL,
  updated_by uuid NOT NULL REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_tenant_entitlements_tenant_code UNIQUE (tenant_id, code),
  CONSTRAINT ck_tenant_entitlements_code_format CHECK (code ~ '^[a-z][a-z0-9_.]*$'),
  CONSTRAINT ck_tenant_entitlements_limit CHECK (limit_value IS NULL OR limit_value >= 0)
);

COMMENT ON TABLE tenant_entitlements IS
  'DBF-PLAT-001: platform-managed entitlement flags. Tenant members read own rows (entitlement.read); platform mode writes.';

-- ---------------------------------------------------------------------------
-- audit_events (lands the deferred audit persistence; append-only)
-- ---------------------------------------------------------------------------

CREATE TABLE audit_events (
  id uuid PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  action text NOT NULL,
  outcome text NOT NULL,
  correlation_id text NOT NULL,
  actor_user_id uuid NULL,
  tenant_id uuid NULL REFERENCES tenants (id),
  resource_type text NULL,
  resource_id text NULL,
  metadata jsonb NULL,
  CONSTRAINT ck_audit_events_outcome CHECK (outcome IN ('success', 'failure', 'denied'))
);

CREATE INDEX ix_audit_events_occurred ON audit_events (occurred_at DESC, id DESC);
CREATE INDEX ix_audit_events_tenant ON audit_events (tenant_id, occurred_at DESC);
CREATE INDEX ix_audit_events_action ON audit_events (action, occurred_at DESC);

COMMENT ON TABLE audit_events IS
  'DBF-PLAT-001: append-only audit trail. Metadata must be redacted before append (redactAuditMetadata). tenant_id NULL = platform-scope event.';

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE platform_operators FROM PUBLIC;
REVOKE ALL ON TABLE tenant_plan_assignments FROM PUBLIC;
REVOKE ALL ON TABLE tenant_entitlements FROM PUBLIC;
REVOKE ALL ON TABLE audit_events FROM PUBLIC;

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    -- Guard lookup only; no writes from runtime role.
    GRANT SELECT ON TABLE platform_operators TO educore_app;
    REVOKE INSERT, UPDATE, DELETE ON TABLE platform_operators FROM educore_app;

    GRANT SELECT ON TABLE tenant_plan_assignments TO educore_app;
    REVOKE INSERT, UPDATE, DELETE ON TABLE tenant_plan_assignments FROM educore_app;

    GRANT SELECT ON TABLE tenant_entitlements TO educore_app;
    REVOKE INSERT, UPDATE, DELETE ON TABLE tenant_entitlements FROM educore_app;

    -- Append-only from tenant paths; never UPDATE/DELETE.
    GRANT SELECT, INSERT ON TABLE audit_events TO educore_app;
    REVOKE UPDATE, DELETE ON TABLE audit_events FROM educore_app;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_platform') THEN
    GRANT SELECT ON TABLE platform_operators TO educore_platform;
    REVOKE INSERT, UPDATE, DELETE ON TABLE platform_operators FROM educore_platform;

    GRANT SELECT, INSERT, UPDATE ON TABLE tenant_plan_assignments TO educore_platform;
    REVOKE DELETE ON TABLE tenant_plan_assignments FROM educore_platform;

    GRANT SELECT, INSERT, UPDATE ON TABLE tenant_entitlements TO educore_platform;
    REVOKE DELETE ON TABLE tenant_entitlements FROM educore_platform;

    GRANT SELECT, INSERT ON TABLE audit_events TO educore_platform;
    REVOKE UPDATE, DELETE ON TABLE audit_events FROM educore_platform;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_migrator') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE platform_operators TO educore_migrator;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE tenant_plan_assignments TO educore_migrator;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE tenant_entitlements TO educore_migrator;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE audit_events TO educore_migrator;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- RLS (platform_operators stays global-catalog: no tenant RLS, app-layer guard)
-- ---------------------------------------------------------------------------

SELECT app.enable_tenant_rls('tenant_plan_assignments'::regclass);
SELECT app.enable_tenant_rls('tenant_entitlements'::regclass);
SELECT app.enable_tenant_rls('audit_events'::regclass);

-- tenant_plan_assignments: tenant reads own; platform trusted full write.
CREATE POLICY rls_tenant_plan_assignments_select
  ON tenant_plan_assignments
  FOR SELECT
  TO educore_app
  USING (app.tenant_isolation_passes(tenant_id));

CREATE POLICY rls_tenant_plan_assignments_select_platform
  ON tenant_plan_assignments
  FOR SELECT
  TO educore_platform
  USING (app.is_trusted_platform_session());

CREATE POLICY rls_tenant_plan_assignments_insert_platform
  ON tenant_plan_assignments
  FOR INSERT
  TO educore_platform
  WITH CHECK (app.is_trusted_platform_session());

CREATE POLICY rls_tenant_plan_assignments_update_platform
  ON tenant_plan_assignments
  FOR UPDATE
  TO educore_platform
  USING (app.is_trusted_platform_session())
  WITH CHECK (app.is_trusted_platform_session());

-- tenant_entitlements: tenant reads own; platform trusted write.
CREATE POLICY rls_tenant_entitlements_select
  ON tenant_entitlements
  FOR SELECT
  TO educore_app
  USING (app.tenant_isolation_passes(tenant_id));

CREATE POLICY rls_tenant_entitlements_select_platform
  ON tenant_entitlements
  FOR SELECT
  TO educore_platform
  USING (app.is_trusted_platform_session());

CREATE POLICY rls_tenant_entitlements_insert_platform
  ON tenant_entitlements
  FOR INSERT
  TO educore_platform
  WITH CHECK (app.is_trusted_platform_session());

CREATE POLICY rls_tenant_entitlements_update_platform
  ON tenant_entitlements
  FOR UPDATE
  TO educore_platform
  USING (app.is_trusted_platform_session())
  WITH CHECK (app.is_trusted_platform_session());

-- audit_events: tenant appends/reads own rows; platform trusted append/read-all.
CREATE POLICY rls_audit_events_select
  ON audit_events
  FOR SELECT
  TO educore_app
  USING (app.tenant_isolation_passes(tenant_id));

CREATE POLICY rls_audit_events_insert
  ON audit_events
  FOR INSERT
  TO educore_app
  WITH CHECK (app.tenant_isolation_passes(tenant_id));

CREATE POLICY rls_audit_events_select_platform
  ON audit_events
  FOR SELECT
  TO educore_platform
  USING (app.is_trusted_platform_session());

CREATE POLICY rls_audit_events_insert_platform
  ON audit_events
  FOR INSERT
  TO educore_platform
  WITH CHECK (app.is_trusted_platform_session());

-- No UPDATE/DELETE policies on audit_events for any runtime role → append-only.

-- ---------------------------------------------------------------------------
-- Suspended-tenant enforcement (ACF-PLAT-001): membership requires live tenant.
-- Members of draft/suspended/closed tenants fail closed at tenant bind.
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
    JOIN tenants t ON t.id = m.tenant_id
    WHERE m.tenant_id = target_tenant_id
      AND m.user_id = app.current_user_id()
      AND m.status = 'active'
      AND t.status = 'active'
  );
END;
$$;

COMMENT ON FUNCTION app.user_has_active_membership(uuid) IS
  'True when current_user has active membership in an ACTIVE tenant (ACF-PLAT-001 suspend rule). SECURITY DEFINER.';
