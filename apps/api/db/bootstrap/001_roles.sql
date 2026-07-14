-- IMP-001-T02: PostgreSQL roles for EduCore local/dev environments.
-- Preferred order: (1) npm run db:migrate  (2) npm run db:bootstrap-roles
-- Run with a privileged connection (e.g. DEV-001 POSTGRES_USER), NOT as educore_app.
-- Passwords are local placeholders only.
--
-- Security:
--   * educore_app      = runtime only; FORCE RLS on tenant tables from P1; no INSERT on tenants/users (AUDIT-R2)
--   * educore_platform = trusted provisioning INSERT only; never NestJS pool (AUDIT-R2)
--   * educore_migrator = DDL only; never configure on the NestJS pool

DO
$$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_migrator') THEN
    CREATE ROLE educore_migrator LOGIN PASSWORD 'educore_migrator_local_only';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    CREATE ROLE educore_app LOGIN PASSWORD 'educore_app_local_only';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_platform') THEN
    CREATE ROLE educore_platform LOGIN PASSWORD 'educore_platform_local_only';
  END IF;
END
$$;

DO
$$
DECLARE
  db_name text := current_database();
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO educore_migrator', db_name);
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO educore_app', db_name);
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO educore_platform', db_name);
END
$$;

GRANT USAGE, CREATE ON SCHEMA public TO educore_migrator;
GRANT USAGE ON SCHEMA public TO educore_app;
GRANT USAGE ON SCHEMA public TO educore_platform;

-- Default privileges require ownership of the target role; skip if not allowed.
DO
$$
BEGIN
  BEGIN
    ALTER DEFAULT PRIVILEGES FOR ROLE educore_migrator IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO educore_app;
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
  BEGIN
    ALTER DEFAULT PRIVILEGES FOR ROLE educore_migrator IN SCHEMA public
      GRANT USAGE, SELECT ON SEQUENCES TO educore_app;
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
END
$$;

DO
$$
BEGIN
  IF to_regclass('public.schema_migrations') IS NOT NULL THEN
    -- Migrator / local bootstrap users need ledger read-write; app may read only.
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE schema_migrations TO educore_migrator;
    GRANT SELECT ON TABLE schema_migrations TO educore_app;
    GRANT SELECT ON TABLE schema_migrations TO educore_platform;
    -- DEV-001 / local superuser-style login often named "educore" or "postgres".
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore') THEN
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE schema_migrations TO educore;
      GRANT USAGE, CREATE ON SCHEMA public TO educore;
    END IF;
  END IF;
END
$$;

COMMENT ON ROLE educore_app IS 'EduCore runtime role. Must not bypass RLS. FORCE RLS from P1. No INSERT on tenants/users after AUDIT-R2.';
COMMENT ON ROLE educore_platform IS 'EduCore provisioning role for tenant/user INSERT. Never NestJS pool.';
COMMENT ON ROLE educore_migrator IS 'EduCore migration role. Never use for application connections.';
