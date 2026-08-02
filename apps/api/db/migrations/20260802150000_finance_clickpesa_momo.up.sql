-- PAY-004 / DBF-012: pending mobile-money attempts + ClickPesa webhook ingest.
-- create_pending_mobile_money_attempt: bursar-initiated BillPay (membership required).
-- ingest_clickpesa_gateway_event: public webhook path (no membership; lookup by attempt id).

CREATE OR REPLACE FUNCTION app.create_pending_mobile_money_attempt(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_payment_id uuid,
  p_invoice_id uuid,
  p_amount_minor bigint,
  p_currency text,
  p_provider_code text,
  p_provider_ref text
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  invoice_id uuid,
  method text,
  amount_minor bigint,
  currency text,
  status text,
  provider_code text,
  provider_ref text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  v_status text;
  v_total_minor bigint;
  v_allocated_minor bigint;
  v_balance_minor bigint;
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_payment_id IS NULL
     OR p_invoice_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF p_amount_minor IS NULL OR p_amount_minor <= 0 THEN
    RAISE EXCEPTION 'invalid amount_minor' USING ERRCODE = '22023';
  END IF;
  IF p_currency IS NULL OR p_currency <> 'TZS' THEN
    RAISE EXCEPTION 'invalid currency' USING ERRCODE = '22023';
  END IF;
  IF p_provider_code IS NULL OR char_length(btrim(p_provider_code)) < 1 THEN
    RAISE EXCEPTION 'invalid provider_code' USING ERRCODE = '22023';
  END IF;
  IF p_provider_ref IS NULL OR char_length(btrim(p_provider_ref)) < 1 THEN
    RAISE EXCEPTION 'invalid provider_ref' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;

  SELECT i.status INTO v_status
  FROM invoices i
  WHERE i.id = p_invoice_id AND i.tenant_id = p_tenant_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'invoice not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_status NOT IN ('issued', 'partially_paid') THEN
    RAISE EXCEPTION 'invoice not payable' USING ERRCODE = '55000';
  END IF;

  SELECT COALESCE(SUM(il.amount_minor), 0) INTO v_total_minor
  FROM invoice_lines il
  WHERE il.invoice_id = p_invoice_id AND il.tenant_id = p_tenant_id;

  SELECT COALESCE(SUM(pal.amount_minor), 0) INTO v_allocated_minor
  FROM payment_allocations pal
  WHERE pal.invoice_id = p_invoice_id AND pal.tenant_id = p_tenant_id AND pal.status = 'active';

  v_balance_minor := v_total_minor - v_allocated_minor;
  IF p_amount_minor > v_balance_minor THEN
    RAISE EXCEPTION 'amount exceeds outstanding balance' USING ERRCODE = '22023';
  END IF;

  INSERT INTO payment_attempts (
    id, tenant_id, invoice_id, method, amount_minor, currency, status,
    provider_code, provider_ref, created_by_user_id, created_at, updated_at
  ) VALUES (
    p_payment_id, p_tenant_id, p_invoice_id, 'mobile_money', p_amount_minor, p_currency, 'pending',
    btrim(p_provider_code), btrim(p_provider_ref), p_actor_user_id, now(), now()
  );

  RETURN QUERY
  SELECT pa.id, pa.tenant_id, pa.invoice_id, pa.method, pa.amount_minor, pa.currency, pa.status,
         pa.provider_code, pa.provider_ref, pa.created_at, pa.updated_at
  FROM payment_attempts pa
  WHERE pa.id = p_payment_id;
END;
$$;

COMMENT ON FUNCTION app.create_pending_mobile_money_attempt(
  uuid, uuid, uuid, uuid, bigint, text, text, text
) IS
  'PAY-004: create pending mobile_money attempt with opaque provider_code/ref (BillPay).';

-- Completes a pending clickpesa attempt: journal + allocation + receipt.
CREATE OR REPLACE FUNCTION app.complete_pending_mobile_money_payment(
  p_tenant_id uuid,
  p_payment_id uuid,
  p_receipt_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  v_attempt payment_attempts%ROWTYPE;
  v_total_minor bigint;
  v_allocated_minor bigint;
  v_balance_minor bigint;
  v_new_balance_minor bigint;
  v_debit_account_id uuid;
  v_credit_account_id uuid;
  v_journal_entry_id uuid;
  v_receipt_number text;
  v_actor uuid;
BEGIN
  SELECT * INTO v_attempt
  FROM payment_attempts pa
  WHERE pa.id = p_payment_id AND pa.tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment attempt not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_attempt.status <> 'pending' OR v_attempt.method <> 'mobile_money' THEN
    RAISE EXCEPTION 'payment not pending mobile_money' USING ERRCODE = '55000';
  END IF;

  v_actor := COALESCE(v_attempt.created_by_user_id, p_payment_id);

  SELECT COALESCE(SUM(il.amount_minor), 0) INTO v_total_minor
  FROM invoice_lines il
  WHERE il.invoice_id = v_attempt.invoice_id AND il.tenant_id = p_tenant_id;

  SELECT COALESCE(SUM(pal.amount_minor), 0) INTO v_allocated_minor
  FROM payment_allocations pal
  WHERE pal.invoice_id = v_attempt.invoice_id AND pal.tenant_id = p_tenant_id AND pal.status = 'active';

  v_balance_minor := v_total_minor - v_allocated_minor;
  IF v_attempt.amount_minor > v_balance_minor THEN
    RAISE EXCEPTION 'amount exceeds outstanding balance' USING ERRCODE = '22023';
  END IF;

  PERFORM app.ensure_tenant_coa(p_tenant_id);

  SELECT coa.id INTO v_debit_account_id
  FROM chart_of_accounts coa
  WHERE coa.tenant_id = p_tenant_id AND coa.code = 'mobile_money_clearing';
  SELECT coa.id INTO v_credit_account_id
  FROM chart_of_accounts coa
  WHERE coa.tenant_id = p_tenant_id AND coa.code = 'fees_receivable';

  v_journal_entry_id := gen_random_uuid();

  INSERT INTO journal_entries (
    id, tenant_id, posted_at, reference_type, reference_id, created_by_user_id, created_at
  ) VALUES (
    v_journal_entry_id, p_tenant_id, now(), 'payment', p_payment_id, v_actor, now()
  );

  INSERT INTO journal_lines (
    id, tenant_id, journal_entry_id, account_id, debit_minor, credit_minor, currency, created_at
  ) VALUES
    (gen_random_uuid(), p_tenant_id, v_journal_entry_id, v_debit_account_id, v_attempt.amount_minor, 0, v_attempt.currency, now()),
    (gen_random_uuid(), p_tenant_id, v_journal_entry_id, v_credit_account_id, 0, v_attempt.amount_minor, v_attempt.currency, now());

  UPDATE payment_attempts pa SET
    status = 'succeeded',
    journal_entry_id = v_journal_entry_id,
    updated_at = now()
  WHERE pa.id = p_payment_id AND pa.tenant_id = p_tenant_id;

  INSERT INTO payment_allocations (
    id, tenant_id, payment_attempt_id, invoice_id, invoice_line_id, amount_minor, status, created_at
  ) VALUES (
    gen_random_uuid(), p_tenant_id, p_payment_id, v_attempt.invoice_id, NULL,
    v_attempt.amount_minor, 'active', now()
  );

  v_receipt_number := 'R-' || replace(p_payment_id::text, '-', '');

  INSERT INTO receipts (
    id, tenant_id, payment_attempt_id, receipt_number, status, issued_at, created_at
  ) VALUES (
    p_receipt_id, p_tenant_id, p_payment_id, v_receipt_number, 'issued', now(), now()
  );

  v_new_balance_minor := v_balance_minor - v_attempt.amount_minor;

  UPDATE invoices i SET
    status = CASE WHEN v_new_balance_minor = 0 THEN 'paid' ELSE 'partially_paid' END,
    updated_at = now()
  WHERE i.id = v_attempt.invoice_id AND i.tenant_id = p_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.ingest_clickpesa_gateway_event(
  p_gateway_event_id uuid,
  p_provider_event_id text,
  p_payload_sha256 text,
  p_order_reference uuid,
  p_amount_minor bigint,
  p_provider_outcome text,
  p_receipt_id uuid
)
RETURNS TABLE (
  tenant_id uuid,
  gateway_event_id uuid,
  inserted boolean,
  payment_attempt_id uuid,
  completed boolean,
  detail text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  v_attempt payment_attempts%ROWTYPE;
  v_existing_id uuid;
  v_inserted boolean;
BEGIN
  IF p_gateway_event_id IS NULL OR p_order_reference IS NULL OR p_receipt_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
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

  SELECT * INTO v_attempt
  FROM payment_attempts pa
  WHERE pa.id = p_order_reference AND pa.provider_code = 'clickpesa';

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, false, p_order_reference, false, 'attempt_not_found';
    RETURN;
  END IF;

  INSERT INTO payment_gateway_events (
    id, tenant_id, provider_code, provider_event_id, payload_sha256, processing_status,
    payment_attempt_id, amount_minor, provider_outcome, received_at
  ) VALUES (
    p_gateway_event_id, v_attempt.tenant_id, 'clickpesa', btrim(p_provider_event_id),
    btrim(p_payload_sha256), 'processed', v_attempt.id, p_amount_minor, p_provider_outcome, now()
  )
  ON CONFLICT (tenant_id, provider_code, provider_event_id) DO NOTHING;

  SELECT e.id INTO v_existing_id
  FROM payment_gateway_events e
  WHERE e.tenant_id = v_attempt.tenant_id AND e.provider_code = 'clickpesa'
    AND e.provider_event_id = btrim(p_provider_event_id);

  v_inserted := (v_existing_id = p_gateway_event_id);

  IF NOT v_inserted THEN
    RETURN QUERY SELECT v_attempt.tenant_id, v_existing_id, false, v_attempt.id, false, 'duplicate';
    RETURN;
  END IF;

  IF p_provider_outcome = 'failed' THEN
    IF v_attempt.status = 'pending' THEN
      UPDATE payment_attempts pa SET status = 'failed', updated_at = now()
      WHERE pa.id = v_attempt.id AND pa.tenant_id = v_attempt.tenant_id AND pa.status = 'pending';
    END IF;
    RETURN QUERY SELECT v_attempt.tenant_id, v_existing_id, true, v_attempt.id, false, 'failed_marked';
    RETURN;
  END IF;

  -- succeeded
  IF p_amount_minor IS DISTINCT FROM v_attempt.amount_minor THEN
    RETURN QUERY SELECT v_attempt.tenant_id, v_existing_id, true, v_attempt.id, false, 'amount_mismatch';
    RETURN;
  END IF;

  IF v_attempt.status <> 'pending' THEN
    RETURN QUERY SELECT v_attempt.tenant_id, v_existing_id, true, v_attempt.id, false, 'not_pending';
    RETURN;
  END IF;

  PERFORM app.complete_pending_mobile_money_payment(
    v_attempt.tenant_id, v_attempt.id, p_receipt_id
  );

  RETURN QUERY SELECT v_attempt.tenant_id, v_existing_id, true, v_attempt.id, true, 'completed';
END;
$$;

COMMENT ON FUNCTION app.ingest_clickpesa_gateway_event(
  uuid, text, text, uuid, bigint, text, uuid
) IS
  'PAY-004: ClickPesa webhook ingest — dedupe, amount check, complete pending MoMo.';

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT EXECUTE ON FUNCTION app.create_pending_mobile_money_attempt(
      uuid, uuid, uuid, uuid, bigint, text, text, text
    ) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.complete_pending_mobile_money_payment(
      uuid, uuid, uuid
    ) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.ingest_clickpesa_gateway_event(
      uuid, text, text, uuid, bigint, text, uuid
    ) TO educore_app;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION app.create_pending_mobile_money_attempt(
  uuid, uuid, uuid, uuid, bigint, text, text, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.complete_pending_mobile_money_payment(
  uuid, uuid, uuid
) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.ingest_clickpesa_gateway_event(
  uuid, text, text, uuid, bigint, text, uuid
) FROM PUBLIC;
