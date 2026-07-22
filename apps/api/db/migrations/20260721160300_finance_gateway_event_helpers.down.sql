-- Down: finance gateway event helper.

DROP FUNCTION IF EXISTS app.record_gateway_event(uuid, uuid, uuid, text, text, text, uuid);
