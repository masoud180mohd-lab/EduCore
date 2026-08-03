-- AI-002 / DBF-AI-001: AI gateway tables, permissions, seed lab.echo, helpers.

CREATE TABLE ai_prompt_templates (
  id uuid PRIMARY KEY,
  tenant_id uuid NULL REFERENCES tenants (id),
  code text NOT NULL,
  version int NOT NULL,
  locale text NOT NULL,
  body text NOT NULL,
  status text NOT NULL,
  allowlist_placeholders jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_ai_prompt_templates_locale CHECK (locale IN ('en', 'sw')),
  CONSTRAINT ck_ai_prompt_templates_status CHECK (status IN ('active', 'retired')),
  CONSTRAINT ck_ai_prompt_templates_version CHECK (version >= 1),
  CONSTRAINT ck_ai_prompt_templates_body_len CHECK (char_length(body) BETWEEN 1 AND 4000)
);

CREATE UNIQUE INDEX uq_ai_prompt_templates_system
  ON ai_prompt_templates (code, locale, version)
  WHERE tenant_id IS NULL;

CREATE UNIQUE INDEX uq_ai_prompt_templates_tenant
  ON ai_prompt_templates (tenant_id, code, locale, version)
  WHERE tenant_id IS NOT NULL;

CREATE TABLE ai_invoke_requests (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  actor_user_id uuid NOT NULL REFERENCES users (id),
  feature_code text NOT NULL,
  prompt_code text NOT NULL,
  prompt_version int NOT NULL,
  locale text NOT NULL,
  correlation_id text NOT NULL,
  status text NOT NULL,
  reject_reason text NULL,
  model_code text NULL,
  provider_code text NULL,
  input_tokens int NULL,
  output_tokens int NULL,
  estimated_cost_minor int NULL,
  output_preview text NULL,
  variables_redacted jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_ai_invoke_locale CHECK (locale IN ('en', 'sw')),
  CONSTRAINT ck_ai_invoke_status CHECK (
    status IN ('succeeded', 'failed', 'rejected', 'disabled')
  ),
  CONSTRAINT ck_ai_invoke_tokens CHECK (
    (input_tokens IS NULL OR input_tokens >= 0)
    AND (output_tokens IS NULL OR output_tokens >= 0)
    AND (estimated_cost_minor IS NULL OR estimated_cost_minor >= 0)
  )
);

CREATE INDEX ix_ai_invoke_tenant_created
  ON ai_invoke_requests (tenant_id, created_at DESC, id ASC);

CREATE INDEX ix_ai_invoke_tenant_feature
  ON ai_invoke_requests (tenant_id, feature_code, created_at DESC);

CREATE TABLE ai_usage_daily (
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  usage_date date NOT NULL,
  feature_code text NOT NULL,
  request_count int NOT NULL DEFAULT 0,
  input_tokens int NOT NULL DEFAULT 0,
  output_tokens int NOT NULL DEFAULT 0,
  estimated_cost_minor int NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, usage_date, feature_code),
  CONSTRAINT ck_ai_usage_counts CHECK (
    request_count >= 0
    AND input_tokens >= 0
    AND output_tokens >= 0
    AND estimated_cost_minor >= 0
  )
);

-- Seed lab.echo (AI-003 early seed so AI-002 Fake path works)
INSERT INTO ai_prompt_templates (
  id, tenant_id, code, version, locale, body, status, allowlist_placeholders
) VALUES
  (
    '01900000-0003-7000-8000-000000000001',
    NULL,
    'lab.echo',
    1,
    'en',
    'ECHO: {{message}}',
    'active',
    '["message"]'::jsonb
  ),
  (
    '01900000-0003-7000-8000-000000000002',
    NULL,
    'lab.echo',
    1,
    'sw',
    'ECHO: {{message}}',
    'active',
    '["message"]'::jsonb
  );

INSERT INTO permissions (id, code, description) VALUES
  ('01900000-0001-7000-8000-000000000054', 'ai.read', 'Read AI prompts, usage, and invoke ledger'),
  ('01900000-0001-7000-8000-000000000055', 'ai.manage', 'Invoke AI lab gateway / manage AI ops')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, now()
FROM roles r
CROSS JOIN permissions p
WHERE r.is_system = true
  AND r.code IN ('owner', 'admin', 'staff')
  AND p.code IN ('ai.read', 'ai.manage')
ON CONFLICT DO NOTHING;

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT SELECT ON TABLE ai_prompt_templates TO educore_app;
    GRANT SELECT ON TABLE ai_invoke_requests TO educore_app;
    GRANT SELECT ON TABLE ai_usage_daily TO educore_app;
    REVOKE INSERT, UPDATE, DELETE ON TABLE ai_prompt_templates FROM educore_app;
    REVOKE INSERT, UPDATE, DELETE ON TABLE ai_invoke_requests FROM educore_app;
    REVOKE INSERT, UPDATE, DELETE ON TABLE ai_usage_daily FROM educore_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_platform') THEN
    GRANT SELECT ON TABLE ai_prompt_templates TO educore_platform;
    GRANT SELECT ON TABLE ai_invoke_requests TO educore_platform;
    GRANT SELECT ON TABLE ai_usage_daily TO educore_platform;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_migrator') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ai_prompt_templates TO educore_migrator;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ai_invoke_requests TO educore_migrator;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ai_usage_daily TO educore_migrator;
  END IF;
END
$$;

REVOKE ALL ON TABLE ai_prompt_templates FROM PUBLIC;
REVOKE ALL ON TABLE ai_invoke_requests FROM PUBLIC;
REVOKE ALL ON TABLE ai_usage_daily FROM PUBLIC;

ALTER TABLE ai_prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_prompt_templates FORCE ROW LEVEL SECURITY;
ALTER TABLE ai_invoke_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_invoke_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_daily FORCE ROW LEVEL SECURITY;

CREATE POLICY rls_ai_prompt_templates_select ON ai_prompt_templates
  FOR SELECT TO educore_app
  USING (tenant_id IS NULL OR tenant_id = app.current_tenant_id());

CREATE POLICY rls_ai_invoke_requests_select ON ai_invoke_requests
  FOR SELECT TO educore_app
  USING (tenant_id = app.current_tenant_id());

CREATE POLICY rls_ai_usage_daily_select ON ai_usage_daily
  FOR SELECT TO educore_app
  USING (tenant_id = app.current_tenant_id());

CREATE OR REPLACE FUNCTION app.ai_complete_invoke(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_request_id uuid,
  p_feature_code text,
  p_prompt_code text,
  p_prompt_version int,
  p_locale text,
  p_correlation_id text,
  p_status text,
  p_reject_reason text,
  p_model_code text,
  p_provider_code text,
  p_input_tokens int,
  p_output_tokens int,
  p_estimated_cost_minor int,
  p_output_preview text,
  p_variables_redacted jsonb,
  p_count_usage boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('succeeded', 'failed', 'rejected', 'disabled') THEN
    RAISE EXCEPTION 'invalid status' USING ERRCODE = '22023';
  END IF;

  INSERT INTO ai_invoke_requests (
    id, tenant_id, actor_user_id, feature_code, prompt_code, prompt_version, locale,
    correlation_id, status, reject_reason, model_code, provider_code,
    input_tokens, output_tokens, estimated_cost_minor, output_preview, variables_redacted, created_at
  ) VALUES (
    p_request_id, p_tenant_id, p_actor_user_id, btrim(p_feature_code), btrim(p_prompt_code),
    p_prompt_version, p_locale, btrim(p_correlation_id), p_status,
    NULLIF(btrim(COALESCE(p_reject_reason, '')), ''),
    NULLIF(btrim(COALESCE(p_model_code, '')), ''),
    NULLIF(btrim(COALESCE(p_provider_code, '')), ''),
    p_input_tokens, p_output_tokens, p_estimated_cost_minor,
    NULLIF(btrim(COALESCE(p_output_preview, '')), ''),
    p_variables_redacted, now()
  );

  IF p_count_usage IS TRUE AND p_status = 'succeeded' THEN
    INSERT INTO ai_usage_daily (
      tenant_id, usage_date, feature_code, request_count, input_tokens, output_tokens, estimated_cost_minor
    ) VALUES (
      p_tenant_id,
      (timezone('utc', now()))::date,
      btrim(p_feature_code),
      1,
      COALESCE(p_input_tokens, 0),
      COALESCE(p_output_tokens, 0),
      COALESCE(p_estimated_cost_minor, 0)
    )
    ON CONFLICT (tenant_id, usage_date, feature_code) DO UPDATE
    SET request_count = ai_usage_daily.request_count + 1,
        input_tokens = ai_usage_daily.input_tokens + COALESCE(EXCLUDED.input_tokens, 0),
        output_tokens = ai_usage_daily.output_tokens + COALESCE(EXCLUDED.output_tokens, 0),
        estimated_cost_minor = ai_usage_daily.estimated_cost_minor + COALESCE(EXCLUDED.estimated_cost_minor, 0);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION app.ai_complete_invoke(
  uuid, uuid, uuid, text, text, int, text, text, text, text, text, text, int, int, int, text, jsonb, boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.ai_complete_invoke(
  uuid, uuid, uuid, text, text, int, text, text, text, text, text, text, int, int, int, text, jsonb, boolean
) TO educore_app;
