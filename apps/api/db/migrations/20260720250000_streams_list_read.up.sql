-- IMP-003-S0 / DBF-006: streams table. educore_app SELECT-only.

CREATE TABLE streams (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  class_id uuid NOT NULL REFERENCES classes (id),
  name text NOT NULL,
  code text NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_streams_name_len CHECK (char_length(name) BETWEEN 1 AND 200),
  CONSTRAINT ck_streams_status CHECK (status IN ('draft', 'active', 'closed')),
  CONSTRAINT ck_streams_code_format CHECK (
    code IS NULL OR code ~ '^[A-Za-z0-9._/-]{1,64}$'
  )
);

COMMENT ON TABLE streams IS
  'Academic Structure: stream under a class (DBF-006).';

CREATE UNIQUE INDEX uq_streams_tenant_class_code
  ON streams (tenant_id, class_id, code)
  WHERE code IS NOT NULL;

CREATE INDEX ix_streams_tenant_class_status ON streams (tenant_id, class_id, status);
CREATE INDEX ix_streams_tenant_class_name ON streams (tenant_id, class_id, name ASC);

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT SELECT ON TABLE streams TO educore_app;
    REVOKE INSERT, UPDATE, DELETE ON TABLE streams FROM educore_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_platform') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE streams TO educore_platform;
    REVOKE DELETE ON TABLE streams FROM educore_platform;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_migrator') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE streams TO educore_migrator;
  END IF;
END
$$;

REVOKE ALL ON TABLE streams FROM PUBLIC;
SELECT app.enable_tenant_rls('streams'::regclass);

CREATE POLICY rls_streams_select ON streams
  FOR SELECT TO educore_app USING (tenant_id = app.current_tenant_id());
CREATE POLICY rls_streams_select_platform ON streams
  FOR SELECT TO educore_platform USING (app.is_trusted_platform_session());
CREATE POLICY rls_streams_insert_platform ON streams
  FOR INSERT TO educore_platform WITH CHECK (app.is_trusted_platform_session());
CREATE POLICY rls_streams_update_platform ON streams
  FOR UPDATE TO educore_platform
  USING (app.is_trusted_platform_session())
  WITH CHECK (app.is_trusted_platform_session());
