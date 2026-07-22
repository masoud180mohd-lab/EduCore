-- IMP-009 Wave G / DBF-012 rev 1.2: gateway event dedupe helper.
-- educore_app is SELECT-only on payment_gateway_events; webhook ingestion
-- writes through this SECURITY DEFINER helper so the unique
-- (tenant_id, provider_code, provider_event_id) constraint is the single
-- source of dedupe truth (ON CONFLICT DO NOTHING).

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
  IF p_provider_code IS NULL OR char_length(btrim(p_provider_code)) < 1 THEN
    RAISE EXCEPTION 'invalid provider_code' USING ERRCODE = '22023';
  END IF;
  IF p_provider_event_id IS NULL OR char_length(btrim(p_provider_event_id)) < 1 THEN
    RAISE EXCEPTION 'invalid provider_event_id' USING ERRCODE = '22023';
  END IF;
  IF p_payload_sha256 IS NULL OR char_length(btrim(p_payload_sha256)) < 1 THEN
    RAISE EXCEPTION 'invalid payload_sha256' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;
  IF p_payment_attempt_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM payment_attempts pa
    WHERE pa.id = p_payment_attempt_id AND pa.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'payment attempt not found' USING ERRCODE = '22023';
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

  -- v_existing_id differs from p_gateway_event_id exactly when the insert
  -- was skipped by ON CONFLICT, i.e. this event_id was already recorded.
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
