-- IMP-021 down: drop enable_user helper.

DROP FUNCTION IF EXISTS app.enable_user(uuid, uuid, uuid);
