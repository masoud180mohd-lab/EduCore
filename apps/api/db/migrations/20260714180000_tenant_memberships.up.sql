-- IMP-001 P1 continuation (conditional freeze): tenant_memberships table (DBF-001).
-- Membership is the bridge user ↔ tenant. No HTTP controllers in this increment.

CREATE TABLE tenant_memberships (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  user_id uuid NOT NULL REFERENCES users (id),
  status text NOT NULL,
  joined_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_tenant_memberships_tenant_user UNIQUE (tenant_id, user_id),
  CONSTRAINT ck_tenant_memberships_status CHECK (
    status IN ('invited', 'active', 'suspended', 'removed')
  )
);

COMMENT ON TABLE tenant_memberships IS
  'Identity And Access: user membership in a tenant. RLS Pattern A + own-row visibility.';

CREATE INDEX ix_tenant_memberships_user_status ON tenant_memberships (user_id, status);
CREATE INDEX ix_tenant_memberships_tenant_status ON tenant_memberships (tenant_id, status);

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT SELECT, UPDATE ON TABLE tenant_memberships TO educore_app;
    REVOKE INSERT, DELETE ON TABLE tenant_memberships FROM educore_app;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_platform') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE tenant_memberships TO educore_platform;
    REVOKE DELETE ON TABLE tenant_memberships FROM educore_platform;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_migrator') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE tenant_memberships TO educore_migrator;
  END IF;
END
$$;

REVOKE ALL ON TABLE tenant_memberships FROM PUBLIC;
