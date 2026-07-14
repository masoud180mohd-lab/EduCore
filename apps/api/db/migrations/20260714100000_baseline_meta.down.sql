-- Rollback baseline meta. Safe only when no dependent app schema exists.
DROP TABLE IF EXISTS schema_migrations;
