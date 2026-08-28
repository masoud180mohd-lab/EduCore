-- IMP-001-T02: PostgreSQL roles for EduCore local/dev environments.
-- Preferred order: (1) npm run db:migrate  (2) npm run db:bootstrap-roles
-- Run with a privileged connection (e.g. DEV-001 POSTGRES_USER), NOT as educore_app.
-- Passwords are local placeholders only.
--
-- Security:
--   * educore_app      = runtime only; FORCE RLS on tenant tables from P1; no INSERT on tenants/users (AUDIT-R2)
--   * educore_webhook  = ClickPesa ingest EXECUTE only (F-017); never general NestJS pool
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

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_webhook') THEN
    CREATE ROLE educore_webhook LOGIN PASSWORD 'educore_webhook_local_only';
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
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO educore_webhook', db_name);
END
$$;

GRANT USAGE, CREATE ON SCHEMA public TO educore_migrator;
GRANT USAGE ON SCHEMA public TO educore_app;
GRANT USAGE ON SCHEMA public TO educore_platform;
GRANT USAGE ON SCHEMA public TO educore_webhook;

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
COMMENT ON ROLE educore_webhook IS 'EduCore ClickPesa webhook ingest role (F-017). EXECUTE ingest only; never general NestJS pool.';
COMMENT ON ROLE educore_platform IS 'EduCore provisioning role for tenant/user INSERT. Never NestJS pool.';
COMMENT ON ROLE educore_migrator IS 'EduCore migration role. Never use for application connections.';

-- F-017: if helpers already exist (migrate-then-bootstrap), bind EXECUTE here too.
DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'app') THEN
    GRANT USAGE ON SCHEMA app TO educore_webhook;
  END IF;

  IF to_regprocedure('app.ingest_clickpesa_gateway_event(uuid, text, text, uuid, bigint, text, uuid)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION app.ingest_clickpesa_gateway_event(
      uuid, text, text, uuid, bigint, text, uuid
    ) TO educore_webhook;
    REVOKE EXECUTE ON FUNCTION app.ingest_clickpesa_gateway_event(
      uuid, text, text, uuid, bigint, text, uuid
    ) FROM educore_app;
  END IF;

  IF to_regprocedure('app.complete_pending_mobile_money_payment(uuid, uuid, uuid)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION app.complete_pending_mobile_money_payment(
      uuid, uuid, uuid
    ) FROM educore_app;
    REVOKE EXECUTE ON FUNCTION app.complete_pending_mobile_money_payment(
      uuid, uuid, uuid
    ) FROM educore_webhook;
  END IF;
END
$$;
