-- IMP-001-T02 baseline (P0).
-- Creates migration bookkeeping only. No Identity/Tenant business tables.
-- Business schema is deferred to Phase P1 (DBF-001).

CREATE TABLE IF NOT EXISTS schema_migrations (
  id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE schema_migrations IS
  'EduCore migration ledger. Business tables are not created in P0.';

-- Local DX: allow common bootstrap/login roles to manage the ledger after CREATE.
DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_migrator') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE schema_migrations TO educore_migrator;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE schema_migrations TO educore;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT SELECT ON TABLE schema_migrations TO educore_app;
  END IF;
END
$$;
