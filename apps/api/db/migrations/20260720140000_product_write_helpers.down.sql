DROP FUNCTION IF EXISTS app.assign_system_role_codes(uuid, uuid, uuid, text[]);
DROP FUNCTION IF EXISTS app.invite_tenant_membership(uuid, uuid, uuid, uuid, citext, text);
DROP FUNCTION IF EXISTS app.replace_tenant_settings(uuid, uuid, integer, jsonb);
