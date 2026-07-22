-- IMP-009 Wave R / DBF-012 rev 1.3: payment reconciliation.
-- Compare payment_attempt vs latest linked gateway event; record immutable row.
-- educore_app SELECT-only; writes via SECURITY DEFINER.

ALTER TABLE payment_gateway_events
  ADD COLUMN IF NOT EXISTS amount_minor bigint NULL,
  ADD COLUMN IF NOT EXISTS provider_outcome text NULL;

ALTER TABLE payment_gateway_events
  DROP CONSTRAINT IF EXISTS ck_gateway_events_amount;
ALTER TABLE payment_gateway_events
  ADD CONSTRAINT ck_gateway_events_amount
  CHECK (amount_minor IS NULL OR amount_minor > 0);

ALTER TABLE payment_gateway_events
  DROP CONSTRAINT IF EXISTS ck_gateway_events_outcome;
ALTER TABLE payment_gateway_events
  ADD CONSTRAINT ck_gateway_events_outcome
  CHECK (
    provider_outcome IS NULL
    OR provider_outcome IN ('succeeded', 'failed')
  );

CREATE TABLE IF NOT EXISTS payment_reconciliations (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  payment_attempt_id uuid NOT NULL REFERENCES payment_attempts (id),
  gateway_event_id uuid NULL REFERENCES payment_gateway_events (id),
  outcome text NOT NULL,
  attempt_amount_minor bigint NOT NULL,
  attempt_status text NOT NULL,
  event_amount_minor bigint NULL,
  event_outcome text NULL,
  created_by_user_id uuid NULL REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_payment_reconciliations_outcome CHECK (
    outcome IN ('matched', 'amount_mismatch', 'missing_event', 'status_mismatch')
  ),
  CONSTRAINT ck_payment_reconciliations_attempt_amount CHECK (attempt_amount_minor > 0)
);

CREATE INDEX IF NOT EXISTS ix_payment_reconciliations_tenant_payment
  ON payment_reconciliations (tenant_id, payment_attempt_id, created_at DESC);

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT SELECT ON TABLE payment_reconciliations TO educore_app;
    REVOKE INSERT, UPDATE, DELETE ON TABLE payment_reconciliations FROM educore_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_migrator') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE payment_reconciliations TO educore_migrator;
  END IF;
END
$$;

-- Replace record_gateway_event to persist amount + outcome for reconcile.
CREATE OR REPLACE FUNCTION app.record_gateway_event(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_gateway_event_id uuid,
  p_provider_code text,
  p_provider_event_id text,
  p_payload_sha256 text,
  p_payment_attempt_id uuid,
  p_amount_minor bigint,
  p_provider_outcome text
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
  IF p_amount_minor IS NULL OR p_amount_minor <= 0 THEN
    RAISE EXCEPTION 'invalid amount_minor' USING ERRCODE = '22023';
  END IF;
  IF p_provider_outcome IS NULL OR p_provider_outcome NOT IN ('succeeded', 'failed') THEN
    RAISE EXCEPTION 'invalid provider_outcome' USING ERRCODE = '22023';
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
    payment_attempt_id, amount_minor, provider_outcome, received_at
  ) VALUES (
    p_gateway_event_id, p_tenant_id, p_provider_code, p_provider_event_id, p_payload_sha256,
    'processed', p_payment_attempt_id, p_amount_minor, p_provider_outcome, now()
  )
  ON CONFLICT (tenant_id, provider_code, provider_event_id) DO NOTHING;

  SELECT e.id INTO v_existing_id
  FROM payment_gateway_events e
  WHERE e.tenant_id = p_tenant_id AND e.provider_code = p_provider_code
    AND e.provider_event_id = p_provider_event_id;

  RETURN QUERY SELECT v_existing_id, (v_existing_id = p_gateway_event_id);
END;
$$;

CREATE OR REPLACE FUNCTION app.reconcile_payment(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_reconciliation_id uuid,
  p_payment_attempt_id uuid
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  payment_attempt_id uuid,
  gateway_event_id uuid,
  outcome text,
  attempt_amount_minor bigint,
  attempt_status text,
  event_amount_minor bigint,
  event_outcome text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  v_attempt payment_attempts%ROWTYPE;
  v_event_id uuid;
  v_event_amount bigint;
  v_event_outcome text;
  v_outcome text;
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL
     OR p_reconciliation_id IS NULL OR p_payment_attempt_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_attempt
  FROM payment_attempts pa
  WHERE pa.id = p_payment_attempt_id AND pa.tenant_id = p_tenant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT e.id, e.amount_minor, e.provider_outcome
    INTO v_event_id, v_event_amount, v_event_outcome
  FROM payment_gateway_events e
  WHERE e.tenant_id = p_tenant_id AND e.payment_attempt_id = p_payment_attempt_id
  ORDER BY e.received_at DESC, e.id ASC
  LIMIT 1;

  IF NOT FOUND THEN
    v_outcome := 'missing_event';
    v_event_id := NULL;
    v_event_amount := NULL;
    v_event_outcome := NULL;
  ELSIF v_event_amount IS NOT NULL
        AND v_event_amount IS DISTINCT FROM v_attempt.amount_minor THEN
    v_outcome := 'amount_mismatch';
  ELSIF v_event_outcome IS NOT NULL
        AND (
          (v_event_outcome = 'succeeded' AND v_attempt.status <> 'succeeded')
          OR (v_event_outcome = 'failed' AND v_attempt.status NOT IN ('failed', 'expired'))
        ) THEN
    v_outcome := 'status_mismatch';
  ELSE
    v_outcome := 'matched';
  END IF;

  INSERT INTO payment_reconciliations (
    id, tenant_id, payment_attempt_id, gateway_event_id, outcome,
    attempt_amount_minor, attempt_status, event_amount_minor, event_outcome,
    created_by_user_id, created_at
  ) VALUES (
    p_reconciliation_id, p_tenant_id, p_payment_attempt_id, v_event_id, v_outcome,
    v_attempt.amount_minor, v_attempt.status, v_event_amount, v_event_outcome,
    p_actor_user_id, now()
  );

  RETURN QUERY
  SELECT
    r.id, r.tenant_id, r.payment_attempt_id, r.gateway_event_id, r.outcome,
    r.attempt_amount_minor, r.attempt_status, r.event_amount_minor, r.event_outcome,
    r.created_at
  FROM payment_reconciliations r
  WHERE r.id = p_reconciliation_id;
END;
$$;

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    -- Drop old 7-arg overload if present.
    BEGIN
      REVOKE ALL ON FUNCTION app.record_gateway_event(
        uuid, uuid, uuid, text, text, text, uuid
      ) FROM PUBLIC;
      REVOKE ALL ON FUNCTION app.record_gateway_event(
        uuid, uuid, uuid, text, text, text, uuid
      ) FROM educore_app;
      DROP FUNCTION IF EXISTS app.record_gateway_event(
        uuid, uuid, uuid, text, text, text, uuid
      );
    EXCEPTION WHEN undefined_function THEN
      NULL;
    END;

    GRANT EXECUTE ON FUNCTION app.record_gateway_event(
      uuid, uuid, uuid, text, text, text, uuid, bigint, text
    ) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.reconcile_payment(
      uuid, uuid, uuid, uuid
    ) TO educore_app;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION app.record_gateway_event(
  uuid, uuid, uuid, text, text, text, uuid, bigint, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.reconcile_payment(
  uuid, uuid, uuid, uuid
) FROM PUBLIC;
