-- IMP-001-T02 baseline (P0).
-- Creates migration bookkeeping only. No Identity/Tenant business tables.
-- Business schema is deferred to Phase P1 (DBF-001).

CREATE TABLE IF NOT EXISTS schema_migrations (
  id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE schema_migrations IS
  'EduCore migration ledger. Business tables are not created in P0.';
