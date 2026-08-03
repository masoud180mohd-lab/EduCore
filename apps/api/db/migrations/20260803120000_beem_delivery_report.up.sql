-- COMMS-004: apply Beem DLR / delivery status without session (SECURITY DEFINER).

CREATE OR REPLACE FUNCTION app.apply_beem_delivery_report(
  p_provider_message_id text,
  p_delivery_status text,
  p_error_code text DEFAULT NULL,
  p_error_message text DEFAULT NULL
)
RETURNS TABLE (
  delivery_id uuid,
  tenant_id uuid,
  request_id uuid,
  updated boolean,
  detail text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  v_delivery notification_deliveries%ROWTYPE;
  v_status text;
BEGIN
  IF p_provider_message_id IS NULL OR btrim(p_provider_message_id) = '' THEN
    RAISE EXCEPTION 'invalid provider_message_id' USING ERRCODE = '22023';
  END IF;

  v_status := lower(btrim(COALESCE(p_delivery_status, '')));
  IF v_status IN ('delivered') THEN
    v_status := 'delivered';
  ELSIF v_status IN ('failed', 'undelivered', 'rejected') THEN
    v_status := 'failed';
  ELSIF v_status IN ('pending', 'submitted', 'sent') THEN
    v_status := 'sent';
  ELSE
    RAISE EXCEPTION 'invalid delivery status' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_delivery
  FROM notification_deliveries d
  WHERE d.provider_code = 'beem'
    AND d.provider_message_id = btrim(p_provider_message_id)
  ORDER BY d.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      NULL::uuid,
      NULL::uuid,
      NULL::uuid,
      false,
      'delivery_not_found'::text;
    RETURN;
  END IF;

  IF v_delivery.status = v_status THEN
    RETURN QUERY SELECT
      v_delivery.id,
      v_delivery.tenant_id,
      v_delivery.request_id,
      false,
      'already_applied'::text;
    RETURN;
  END IF;

  UPDATE notification_deliveries
  SET status = v_status,
      error_code = COALESCE(NULLIF(btrim(COALESCE(p_error_code, '')), ''), error_code),
      error_message = COALESCE(NULLIF(btrim(COALESCE(p_error_message, '')), ''), error_message),
      updated_at = now()
  WHERE id = v_delivery.id;

  IF v_status = 'delivered' THEN
    UPDATE notification_requests
    SET status = 'succeeded', updated_at = now()
    WHERE id = v_delivery.request_id
      AND status IN ('queued', 'sending', 'succeeded');
  ELSIF v_status = 'failed' THEN
    UPDATE notification_requests
    SET status = 'failed', updated_at = now()
    WHERE id = v_delivery.request_id
      AND status IN ('queued', 'sending', 'succeeded');
  END IF;

  RETURN QUERY SELECT
    v_delivery.id,
    v_delivery.tenant_id,
    v_delivery.request_id,
    true,
    'updated'::text;
END;
$$;

REVOKE ALL ON FUNCTION app.apply_beem_delivery_report(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.apply_beem_delivery_report(text, text, text, text) TO educore_app;
