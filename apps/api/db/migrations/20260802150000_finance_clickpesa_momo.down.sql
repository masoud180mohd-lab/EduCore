DROP FUNCTION IF EXISTS app.ingest_clickpesa_gateway_event(
  uuid, text, text, uuid, bigint, text, uuid
);
DROP FUNCTION IF EXISTS app.complete_pending_mobile_money_payment(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS app.create_pending_mobile_money_attempt(
  uuid, uuid, uuid, uuid, bigint, text, text, text
);
