-- AI-002 down.

DROP FUNCTION IF EXISTS app.ai_complete_invoke(
  uuid, uuid, uuid, text, text, int, text, text, text, text, text, text, int, int, int, text, jsonb, boolean
);

DELETE FROM role_permissions
WHERE permission_id IN (
  SELECT id FROM permissions WHERE code IN ('ai.read', 'ai.manage')
);

DELETE FROM permissions WHERE code IN ('ai.read', 'ai.manage');

DROP TABLE IF EXISTS ai_usage_daily;
DROP TABLE IF EXISTS ai_invoke_requests;
DROP TABLE IF EXISTS ai_prompt_templates;
