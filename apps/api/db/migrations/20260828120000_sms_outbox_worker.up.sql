-- COMMS-006: SMS outbox worker — claim + reschedule helpers.
--
-- The create path (app.create_notification_request) already enqueues
-- outbox_events rows (event_type='notification.send_requested', status='pending').
-- These helpers let the in-process worker drain them safely:
--   * claim parks available_at forward (FOR UPDATE SKIP LOCKED) so concurrent
--     workers never double-send; a crashed sender's claim expires after the
--     park window and the event is re-claimed (at-least-once delivery).
--   * reschedule re-parks a failed attempt with backoff, recording last_error.
-- Dead-lettering reuses the existing 'failed' status via
-- app.complete_notification_send('failed', ...), which also records the final
-- delivery row and flips the request status — the worker calls it directly.
--
-- Worker-only surface: educore_app may EXECUTE these, but no HTTP route does.

CREATE OR REPLACE FUNCTION app.claim_pending_notification_outbox(
  p_batch_size int,
  p_claim_seconds int
)
RETURNS TABLE (
  event_id uuid,
  tenant_id uuid,
  request_id uuid,
  attempts int,
  created_by_user_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
  IF p_batch_size IS NULL OR p_batch_size < 1 OR p_batch_size > 100 THEN
    RAISE EXCEPTION 'invalid batch size' USING ERRCODE = '22023';
  END IF;
  IF p_claim_seconds IS NULL OR p_claim_seconds < 10 OR p_claim_seconds > 3600 THEN
    RAISE EXCEPTION 'invalid claim seconds' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH claimed AS (
    UPDATE outbox_events o
    SET available_at = now() + make_interval(secs => p_claim_seconds),
        attempts = o.attempts + 1
    WHERE o.id IN (
      SELECT e.id
      FROM outbox_events e
      JOIN notification_requests r
        ON r.id = e.aggregate_id
       AND r.tenant_id = e.tenant_id
       AND r.status = 'queued'
      WHERE e.status = 'pending'
        AND e.event_type = 'notification.send_requested'
        AND e.available_at <= now()
      ORDER BY e.available_at ASC, e.id ASC
      LIMIT p_batch_size
      FOR UPDATE OF e SKIP LOCKED
    )
    RETURNING o.id, o.tenant_id, o.aggregate_id, o.attempts
  )
  SELECT c.id, c.tenant_id, c.aggregate_id, c.attempts, r.created_by_user_id
  FROM claimed c
  JOIN notification_requests r
    ON r.id = c.aggregate_id
   AND r.tenant_id = c.tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.reschedule_notification_outbox(
  p_event_id uuid,
  p_tenant_id uuid,
  p_delay_seconds int,
  p_error text
)
RETURNS TABLE (
  attempts int,
  rescheduled boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  v_attempts int;
BEGIN
  IF p_event_id IS NULL OR p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF p_delay_seconds IS NULL OR p_delay_seconds < 0 OR p_delay_seconds > 86400 THEN
    RAISE EXCEPTION 'invalid delay seconds' USING ERRCODE = '22023';
  END IF;

  UPDATE outbox_events o
  SET available_at = now() + make_interval(secs => p_delay_seconds),
      last_error = left(COALESCE(p_error, 'send failed'), 500)
  WHERE o.id = p_event_id
    AND o.tenant_id = p_tenant_id
    AND o.status = 'pending'
  RETURNING o.attempts INTO v_attempts;

  IF v_attempts IS NULL THEN
    RETURN QUERY SELECT 0::int, false;
  ELSE
    RETURN QUERY SELECT v_attempts, true;
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT EXECUTE ON FUNCTION app.claim_pending_notification_outbox(int, int) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.reschedule_notification_outbox(uuid, uuid, int, text) TO educore_app;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION app.claim_pending_notification_outbox(int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.reschedule_notification_outbox(uuid, uuid, int, text) FROM PUBLIC;
