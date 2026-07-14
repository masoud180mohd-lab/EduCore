-- IMP-001-T05 (P1): Global catalog tables only (DBF-001).
-- Tenant-owned tables (users, memberships, entitlements, roles, …) are deferred until RLS is proven.

CREATE TABLE permissions (
  id uuid PRIMARY KEY,
  code text NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_permissions_code UNIQUE (code),
  CONSTRAINT ck_permissions_code_format CHECK (code ~ '^[a-z][a-z0-9_.]*$')
);

COMMENT ON TABLE permissions IS
  'Global permission catalog (Identity And Access). Not tenant-owned; no tenant RLS.';

CREATE TABLE plans (
  id uuid PRIMARY KEY,
  code text NOT NULL,
  name text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_plans_code UNIQUE (code),
  CONSTRAINT ck_plans_code_format CHECK (code ~ '^[a-z0-9-]{2,64}$'),
  CONSTRAINT ck_plans_status CHECK (status IN ('active', 'inactive', 'deprecated'))
);

COMMENT ON TABLE plans IS
  'Global commercial plan catalog (Tenant And Billing). Not tenant-owned; no tenant RLS.';

-- Runtime app: read-only on catalogs (writes via migrator/admin only).
DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT SELECT ON TABLE permissions TO educore_app;
    GRANT SELECT ON TABLE plans TO educore_app;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_migrator') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE permissions TO educore_migrator;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE plans TO educore_migrator;
  END IF;
END
$$;
