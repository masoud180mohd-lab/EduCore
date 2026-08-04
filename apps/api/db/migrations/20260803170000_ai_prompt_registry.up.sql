-- AI-003: prompt registry immutability + publish helper.

CREATE OR REPLACE FUNCTION app.ai_prompt_templates_enforce_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.code IS DISTINCT FROM OLD.code
       OR NEW.version IS DISTINCT FROM OLD.version
       OR NEW.locale IS DISTINCT FROM OLD.locale
       OR NEW.body IS DISTINCT FROM OLD.body
       OR NEW.allowlist_placeholders IS DISTINCT FROM OLD.allowlist_placeholders
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'ai_prompt_templates immutable fields cannot be updated; publish a new version'
        USING ERRCODE = '22023';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status NOT IN ('active', 'retired') THEN
      RAISE EXCEPTION 'invalid ai_prompt_templates status' USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_prompt_templates_immutability ON ai_prompt_templates;
CREATE TRIGGER trg_ai_prompt_templates_immutability
  BEFORE UPDATE ON ai_prompt_templates
  FOR EACH ROW
  EXECUTE FUNCTION app.ai_prompt_templates_enforce_immutability();

-- Publish a new system (tenant_id NULL) prompt version; retires prior active rows for code+locale.
CREATE OR REPLACE FUNCTION app.ai_publish_system_prompt_version(
  p_id uuid,
  p_code text,
  p_locale text,
  p_body text,
  p_allowlist_placeholders jsonb
)
RETURNS TABLE (
  id uuid,
  code text,
  version int,
  locale text,
  body text,
  status text,
  allowlist_placeholders jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  v_next int;
BEGIN
  IF p_id IS NULL OR btrim(COALESCE(p_code, '')) = '' OR btrim(COALESCE(p_locale, '')) = '' THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF p_locale NOT IN ('en', 'sw') THEN
    RAISE EXCEPTION 'invalid locale' USING ERRCODE = '22023';
  END IF;
  IF char_length(btrim(p_body)) < 1 OR char_length(p_body) > 4000 THEN
    RAISE EXCEPTION 'invalid body length' USING ERRCODE = '22023';
  END IF;
  IF p_allowlist_placeholders IS NULL OR jsonb_typeof(p_allowlist_placeholders) <> 'array' THEN
    RAISE EXCEPTION 'allowlist_placeholders must be a JSON array' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(MAX(t.version), 0) + 1
    INTO v_next
  FROM ai_prompt_templates t
  WHERE t.tenant_id IS NULL
    AND t.code = btrim(p_code)
    AND t.locale = p_locale;

  UPDATE ai_prompt_templates t
     SET status = 'retired'
   WHERE t.tenant_id IS NULL
     AND t.code = btrim(p_code)
     AND t.locale = p_locale
     AND t.status = 'active';

  INSERT INTO ai_prompt_templates (
    id, tenant_id, code, version, locale, body, status, allowlist_placeholders, created_at
  ) VALUES (
    p_id,
    NULL,
    btrim(p_code),
    v_next,
    p_locale,
    p_body,
    'active',
    p_allowlist_placeholders,
    now()
  );

  RETURN QUERY
  SELECT t.id, t.code, t.version, t.locale, t.body, t.status, t.allowlist_placeholders, t.created_at
  FROM ai_prompt_templates t
  WHERE t.id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION app.ai_publish_system_prompt_version(uuid, text, text, text, jsonb) FROM PUBLIC;

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_migrator') THEN
    GRANT EXECUTE ON FUNCTION app.ai_publish_system_prompt_version(uuid, text, text, text, jsonb)
      TO educore_migrator;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_platform') THEN
    GRANT EXECUTE ON FUNCTION app.ai_publish_system_prompt_version(uuid, text, text, text, jsonb)
      TO educore_platform;
  END IF;
END
$$;

-- Ensure lab.echo seed present (idempotent for environments that had AI-002 before seed polish).
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
  )
ON CONFLICT DO NOTHING;
