-- IMP-001-T10 foundation (P1): session GUC helpers + RLS enablement helper.
-- Does NOT attach policies to tenant-owned tables yet (those tables are not created).
-- Tenant-owned tables created in later P1 tasks MUST call app.enable_tenant_rls(table).

CREATE SCHEMA IF NOT EXISTS app;

COMMENT ON SCHEMA app IS
  'EduCore application helpers for tenant context and RLS (DBF-001).';

-- Returns current tenant UUID from transaction-local GUC, or NULL if unset/invalid.
CREATE OR REPLACE FUNCTION app.current_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  raw text;
BEGIN
  raw := NULLIF(current_setting('app.current_tenant', true), '');
  IF raw IS NULL THEN
    RETURN NULL;
  END IF;
  BEGIN
    RETURN raw::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RETURN NULL;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION app.current_user_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  raw text;
BEGIN
  raw := NULLIF(current_setting('app.current_user', true), '');
  IF raw IS NULL THEN
    RETURN NULL;
  END IF;
  BEGIN
    RETURN raw::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RETURN NULL;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION app.is_platform_operator()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT lower(coalesce(nullif(current_setting('app.is_platform_operator', true), ''), 'false'))
    IN ('true', '1', 'yes', 'on');
$$;

CREATE OR REPLACE FUNCTION app.rls_mode()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT lower(coalesce(nullif(current_setting('app.rls_mode', true), ''), 'tenant'));
$$;

-- Standard tenant predicate used by future policies (Pattern A in DBF-001).
CREATE OR REPLACE FUNCTION app.tenant_isolation_passes(row_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT row_tenant_id IS NOT NULL
    AND app.current_tenant_id() IS NOT NULL
    AND row_tenant_id = app.current_tenant_id();
$$;

-- Enables + FORCEs RLS on a tenant-owned table for the runtime role model.
-- Policies must still be created per table (P1 later tasks / T10 completion).
CREATE OR REPLACE FUNCTION app.enable_tenant_rls(target_table regclass)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', target_table);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', target_table);
END;
$$;

COMMENT ON FUNCTION app.enable_tenant_rls(regclass) IS
  'ENABLE + FORCE RLS on tenant-owned tables. App role must never bypass RLS.';

COMMENT ON FUNCTION app.tenant_isolation_passes(uuid) IS
  'DBF-001 Pattern A: tenant_id = app.current_tenant (transaction-scoped).';

-- Global catalogs intentionally have no tenant RLS (Pattern E).
-- Deny table ownership surprises: revoke public access if present.
REVOKE ALL ON TABLE permissions FROM PUBLIC;
REVOKE ALL ON TABLE plans FROM PUBLIC;

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT SELECT ON TABLE permissions TO educore_app;
    GRANT SELECT ON TABLE plans TO educore_app;
    -- Explicitly no INSERT/UPDATE/DELETE for runtime role on catalogs.
    REVOKE INSERT, UPDATE, DELETE ON TABLE permissions FROM educore_app;
    REVOKE INSERT, UPDATE, DELETE ON TABLE plans FROM educore_app;
  END IF;
END
$$;
