-- Extensions are left installed (shared); safe no-op down for local multi-slice DBs.
-- DROP EXTENSION is intentionally omitted to avoid breaking other databases that share the cluster.
SELECT 1;
