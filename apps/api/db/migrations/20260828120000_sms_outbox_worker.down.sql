DROP FUNCTION IF EXISTS app.reschedule_notification_outbox(uuid, uuid, int, text);
DROP FUNCTION IF EXISTS app.claim_pending_notification_outbox(int, int);
