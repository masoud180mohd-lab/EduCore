-- IMP-022 down: drop tenant role administration helpers.

DROP FUNCTION IF EXISTS app.unassign_user_role(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS app.assign_user_role(uuid, uuid, uuid, uuid, uuid);
DROP FUNCTION IF EXISTS app.replace_role_permissions(uuid, uuid, uuid, text[]);
DROP FUNCTION IF EXISTS app.rename_role(uuid, uuid, uuid, text);
DROP FUNCTION IF EXISTS app.create_custom_role(uuid, uuid, uuid, text, text, text[]);
