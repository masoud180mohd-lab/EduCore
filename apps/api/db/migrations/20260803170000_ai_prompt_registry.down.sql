-- AI-003 down: remove publish helper + immutability trigger.

DROP FUNCTION IF EXISTS app.ai_publish_system_prompt_version(uuid, text, text, text, jsonb);
DROP TRIGGER IF EXISTS trg_ai_prompt_templates_immutability ON ai_prompt_templates;
DROP FUNCTION IF EXISTS app.ai_prompt_templates_enforce_immutability();
