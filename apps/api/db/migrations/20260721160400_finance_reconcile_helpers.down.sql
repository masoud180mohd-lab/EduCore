-- Down: IMP-009 Wave R reconcile helpers.

DROP FUNCTION IF EXISTS app.reconcile_payment(uuid, uuid, uuid, uuid);

DROP FUNCTION IF EXISTS app.record_gateway_event(
  uuid, uuid, uuid, text, text, text, uuid, bigint, text
);

-- Restore prior 7-arg signature used by Wave G.
CREATE OR REPLACE FUNCTION app.record_gateway_event(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_gateway_event_id uuid,
  p_provider_code text,
  p_provider_event_id text,
  p_payload_sha256 text,
  p_payment_attempt_id uuid
)
RETURNS TABLE (
  id uuid,
  inserted boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  v_existing_id uuid;
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_gateway_event_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;

  INSERT INTO payment_gateway_events (
    id, tenant_id, provider_code, provider_event_id, payload_sha256, processing_status,
    payment_attempt_id, received_at
  ) VALUES (
    p_gateway_event_id, p_tenant_id, p_provider_code, p_provider_event_id, p_payload_sha256,
    'processed', p_payment_attempt_id, now()
  )
  ON CONFLICT (tenant_id, provider_code, provider_event_id) DO NOTHING;

  SELECT e.id INTO v_existing_id
  FROM payment_gateway_events e
  WHERE e.tenant_id = p_tenant_id AND e.provider_code = p_provider_code
    AND e.provider_event_id = p_provider_event_id;

  RETURN QUERY SELECT v_existing_id, (v_existing_id = p_gateway_event_id);
END;
$$;

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT EXECUTE ON FUNCTION app.record_gateway_event(
      uuid, uuid, uuid, text, text, text, uuid
    ) TO educore_app;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION app.record_gateway_event(
  uuid, uuid, uuid, text, text, text, uuid
) FROM PUBLIC;

DROP TABLE IF EXISTS payment_reconciliations;

ALTER TABLE payment_gateway_events
  DROP CONSTRAINT IF EXISTS ck_gateway_events_amount;
ALTER TABLE payment_gateway_events
  DROP CONSTRAINT IF EXISTS ck_gateway_events_outcome;
ALTER TABLE payment_gateway_events
  DROP COLUMN IF EXISTS amount_minor;
ALTER TABLE payment_gateway_events
  DROP COLUMN IF EXISTS provider_outcome;
