-- F-017: educore_app must not EXECUTE money-posting MoMo SECURITY DEFINER helpers.
-- complete_pending_mobile_money_payment is internal (called by ingest as definer).
-- ingest_clickpesa_gateway_event is HMAC-gated at HTTP; DB EXECUTE moves to educore_webhook.

REVOKE ALL ON FUNCTION app.complete_pending_mobile_money_payment(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.ingest_clickpesa_gateway_event(
  uuid, text, text, uuid, bigint, text, uuid
) FROM PUBLIC;

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    REVOKE EXECUTE ON FUNCTION app.complete_pending_mobile_money_payment(
      uuid, uuid, uuid
    ) FROM educore_app;
    REVOKE EXECUTE ON FUNCTION app.ingest_clickpesa_gateway_event(
      uuid, text, text, uuid, bigint, text, uuid
    ) FROM educore_app;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_webhook') THEN
    BEGIN
      EXECUTE format(
        'GRANT CONNECT ON DATABASE %I TO educore_webhook',
        current_database()
      );
    EXCEPTION
      WHEN insufficient_privilege THEN
        NULL;
    END;
    GRANT USAGE ON SCHEMA public TO educore_webhook;
    GRANT USAGE ON SCHEMA app TO educore_webhook;
    GRANT EXECUTE ON FUNCTION app.ingest_clickpesa_gateway_event(
      uuid, text, text, uuid, bigint, text, uuid
    ) TO educore_webhook;
    REVOKE EXECUTE ON FUNCTION app.complete_pending_mobile_money_payment(
      uuid, uuid, uuid
    ) FROM educore_webhook;
  END IF;
END
$$;
