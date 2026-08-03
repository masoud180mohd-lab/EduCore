-- COMMS-003 / DBF-013 down.

DROP FUNCTION IF EXISTS app.complete_notification_send(
  uuid, uuid, uuid, uuid, text, text, text, text, text, int, text, text
);
DROP FUNCTION IF EXISTS app.create_notification_request(
  uuid, uuid, uuid, text, text, text, uuid, jsonb, text, int, uuid
);

DROP TABLE IF EXISTS outbox_events;
DROP TABLE IF EXISTS notification_usage_daily;
DROP TABLE IF EXISTS notification_deliveries;
DROP TABLE IF EXISTS notification_requests;
DROP TABLE IF EXISTS notification_templates;

DELETE FROM role_permissions
WHERE permission_id IN (
  SELECT id FROM permissions WHERE code IN ('notification.read', 'notification.manage')
);

DELETE FROM permissions WHERE code IN ('notification.read', 'notification.manage');
