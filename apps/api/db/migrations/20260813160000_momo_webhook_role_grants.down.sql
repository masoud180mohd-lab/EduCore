-- F-017 down: restore PAY-004 EXECUTE grants on educore_app.

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_webhook') THEN
    REVOKE EXECUTE ON FUNCTION app.ingest_clickpesa_gateway_event(
      uuid, text, text, uuid, bigint, text, uuid
    ) FROM educore_webhook;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT EXECUTE ON FUNCTION app.complete_pending_mobile_money_payment(
      uuid, uuid, uuid
    ) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.ingest_clickpesa_gateway_event(
      uuid, text, text, uuid, bigint, text, uuid
    ) TO educore_app;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION app.complete_pending_mobile_money_payment(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.ingest_clickpesa_gateway_event(
  uuid, text, text, uuid, bigint, text, uuid
) FROM PUBLIC;
