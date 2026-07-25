-- IMP-020 down: drop membership lifecycle helpers.

DROP FUNCTION IF EXISTS app.remove_membership(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS app.reactivate_membership(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS app.suspend_membership(uuid, uuid, uuid);
