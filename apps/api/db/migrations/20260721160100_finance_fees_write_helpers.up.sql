-- DBF-012 / ADR-004: finance fees SECURITY DEFINER write helpers.
-- educore_app is SELECT-only on finance.* tables; all money-affecting writes
-- (fee structures, invoices, issuance, manual payments) go through these
-- functions so the ledger stays the single source of truth.

CREATE OR REPLACE FUNCTION app.ensure_tenant_coa(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;

  INSERT INTO chart_of_accounts (id, tenant_id, code, name, account_type, created_at)
  VALUES
    (gen_random_uuid(), p_tenant_id, 'fees_receivable', 'Fees Receivable', 'asset', now()),
    (gen_random_uuid(), p_tenant_id, 'cash', 'Cash', 'asset', now()),
    (gen_random_uuid(), p_tenant_id, 'mobile_money_clearing', 'Mobile Money Clearing', 'asset', now()),
    (gen_random_uuid(), p_tenant_id, 'fee_revenue', 'Fee Revenue', 'income', now())
  ON CONFLICT (tenant_id, code) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION app.create_fee_structure(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_structure_id uuid,
  p_academic_year_id uuid,
  p_name text,
  p_status text,
  p_currency text,
  p_items jsonb
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  academic_year_id uuid,
  name text,
  status text,
  currency text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  r jsonb;
  v_item_id uuid;
  v_item_name text;
  v_amount_minor bigint;
  v_sort_order int;
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_structure_id IS NULL
     OR p_academic_year_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF p_name IS NULL OR char_length(btrim(p_name)) < 1 OR char_length(btrim(p_name)) > 200 THEN
    RAISE EXCEPTION 'invalid name' USING ERRCODE = '22023';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('draft', 'active', 'archived') THEN
    RAISE EXCEPTION 'invalid status' USING ERRCODE = '22023';
  END IF;
  IF p_currency IS NULL OR p_currency <> 'TZS' THEN
    RAISE EXCEPTION 'invalid currency' USING ERRCODE = '22023';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) < 1 THEN
    RAISE EXCEPTION 'invalid items' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM academic_years y
    WHERE y.id = p_academic_year_id AND y.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'academic year not found' USING ERRCODE = '22023';
  END IF;

  INSERT INTO fee_structures (
    id, tenant_id, academic_year_id, name, status, currency, created_at, updated_at
  ) VALUES (
    p_structure_id, p_tenant_id, p_academic_year_id, btrim(p_name), p_status, p_currency, now(), now()
  );

  FOR r IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_id := (r->>'id')::uuid;
    v_item_name := btrim(COALESCE(r->>'name', ''));
    v_amount_minor := (r->>'amountMinor')::bigint;
    v_sort_order := COALESCE((r->>'sortOrder')::int, 0);

    IF v_item_id IS NULL THEN
      RAISE EXCEPTION 'invalid item id' USING ERRCODE = '22023';
    END IF;
    IF char_length(v_item_name) < 1 OR char_length(v_item_name) > 200 THEN
      RAISE EXCEPTION 'invalid item name' USING ERRCODE = '22023';
    END IF;
    IF v_amount_minor IS NULL OR v_amount_minor <= 0 THEN
      RAISE EXCEPTION 'invalid item amountMinor' USING ERRCODE = '22023';
    END IF;

    INSERT INTO fee_structure_items (
      id, tenant_id, fee_structure_id, name, amount_minor, sort_order, created_at
    ) VALUES (
      v_item_id, p_tenant_id, p_structure_id, v_item_name, v_amount_minor, v_sort_order, now()
    );
  END LOOP;

  RETURN QUERY
  SELECT fs.id, fs.tenant_id, fs.academic_year_id, fs.name, fs.status, fs.currency,
         fs.created_at, fs.updated_at
  FROM fee_structures fs WHERE fs.id = p_structure_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.create_invoice_draft(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_invoice_id uuid,
  p_student_id uuid,
  p_academic_year_id uuid,
  p_fee_structure_id uuid,
  p_lines jsonb
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  student_id uuid,
  academic_year_id uuid,
  fee_structure_id uuid,
  status text,
  currency text,
  issued_at timestamptz,
  voided_at timestamptz,
  issue_journal_entry_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  r jsonb;
  v_line_id uuid;
  v_description text;
  v_amount_minor bigint;
  v_fee_structure_item_id uuid;
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_invoice_id IS NULL
     OR p_student_id IS NULL OR p_academic_year_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) < 1 THEN
    RAISE EXCEPTION 'invalid lines' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM students s WHERE s.id = p_student_id AND s.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'student not found' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM academic_years y
    WHERE y.id = p_academic_year_id AND y.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'academic year not found' USING ERRCODE = '22023';
  END IF;
  IF p_fee_structure_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM fee_structures fs
    WHERE fs.id = p_fee_structure_id AND fs.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'fee structure not found' USING ERRCODE = '22023';
  END IF;

  INSERT INTO invoices (
    id, tenant_id, student_id, academic_year_id, fee_structure_id, status, currency,
    created_at, updated_at
  ) VALUES (
    p_invoice_id, p_tenant_id, p_student_id, p_academic_year_id, p_fee_structure_id,
    'draft', 'TZS', now(), now()
  );

  FOR r IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_line_id := (r->>'id')::uuid;
    v_description := btrim(COALESCE(r->>'description', ''));
    v_amount_minor := (r->>'amountMinor')::bigint;

    IF v_line_id IS NULL THEN
      RAISE EXCEPTION 'invalid line id' USING ERRCODE = '22023';
    END IF;
    IF char_length(v_description) < 1 OR char_length(v_description) > 200 THEN
      RAISE EXCEPTION 'invalid line description' USING ERRCODE = '22023';
    END IF;
    IF v_amount_minor IS NULL OR v_amount_minor <= 0 THEN
      RAISE EXCEPTION 'invalid line amountMinor' USING ERRCODE = '22023';
    END IF;

    IF r ? 'feeStructureItemId' AND r->>'feeStructureItemId' IS NOT NULL
       AND r->>'feeStructureItemId' <> '' THEN
      v_fee_structure_item_id := (r->>'feeStructureItemId')::uuid;
      IF NOT EXISTS (
        SELECT 1 FROM fee_structure_items fsi
        WHERE fsi.id = v_fee_structure_item_id AND fsi.tenant_id = p_tenant_id
      ) THEN
        RAISE EXCEPTION 'fee structure item not found' USING ERRCODE = '22023';
      END IF;
    ELSE
      v_fee_structure_item_id := NULL;
    END IF;

    INSERT INTO invoice_lines (
      id, tenant_id, invoice_id, description, amount_minor, fee_structure_item_id, created_at
    ) VALUES (
      v_line_id, p_tenant_id, p_invoice_id, v_description, v_amount_minor, v_fee_structure_item_id, now()
    );
  END LOOP;

  RETURN QUERY
  SELECT i.id, i.tenant_id, i.student_id, i.academic_year_id, i.fee_structure_id, i.status,
         i.currency, i.issued_at, i.voided_at, i.issue_journal_entry_id, i.created_at, i.updated_at
  FROM invoices i WHERE i.id = p_invoice_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.issue_invoice(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_invoice_id uuid
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  student_id uuid,
  academic_year_id uuid,
  fee_structure_id uuid,
  status text,
  currency text,
  issued_at timestamptz,
  voided_at timestamptz,
  issue_journal_entry_id uuid,
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
  v_fees_receivable_id uuid;
  v_fee_revenue_id uuid;
  v_journal_entry_id uuid;
  v_debit_sum bigint;
  v_credit_sum bigint;
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_invoice_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
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
  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'invoice not in draft status' USING ERRCODE = '55000';
  END IF;

  SELECT COALESCE(SUM(il.amount_minor), 0) INTO v_total_minor
  FROM invoice_lines il
  WHERE il.invoice_id = p_invoice_id AND il.tenant_id = p_tenant_id;

  IF v_total_minor <= 0 THEN
    RAISE EXCEPTION 'invoice has no lines' USING ERRCODE = '22023';
  END IF;

  PERFORM app.ensure_tenant_coa(p_tenant_id);

  SELECT coa.id INTO v_fees_receivable_id
  FROM chart_of_accounts coa
  WHERE coa.tenant_id = p_tenant_id AND coa.code = 'fees_receivable';
  SELECT coa.id INTO v_fee_revenue_id
  FROM chart_of_accounts coa
  WHERE coa.tenant_id = p_tenant_id AND coa.code = 'fee_revenue';

  v_journal_entry_id := gen_random_uuid();

  INSERT INTO journal_entries (
    id, tenant_id, posted_at, reference_type, reference_id, created_by_user_id, created_at
  ) VALUES (
    v_journal_entry_id, p_tenant_id, now(), 'invoice_issue', p_invoice_id, p_actor_user_id, now()
  );

  INSERT INTO journal_lines (
    id, tenant_id, journal_entry_id, account_id, debit_minor, credit_minor, currency, created_at
  ) VALUES
    (gen_random_uuid(), p_tenant_id, v_journal_entry_id, v_fees_receivable_id, v_total_minor, 0, 'TZS', now()),
    (gen_random_uuid(), p_tenant_id, v_journal_entry_id, v_fee_revenue_id, 0, v_total_minor, 'TZS', now());

  -- Defensive balance check per ADR-004 ("every journal entry balances"); the
  -- two lines above are constructed equal, but this guards future edits.
  SELECT COALESCE(SUM(jl.debit_minor), 0), COALESCE(SUM(jl.credit_minor), 0)
  INTO v_debit_sum, v_credit_sum
  FROM journal_lines jl
  WHERE jl.journal_entry_id = v_journal_entry_id;

  IF v_debit_sum <> v_credit_sum THEN
    RAISE EXCEPTION 'journal entry not balanced' USING ERRCODE = '55000';
  END IF;

  UPDATE invoices i SET
    status = 'issued',
    issued_at = now(),
    issue_journal_entry_id = v_journal_entry_id,
    updated_at = now()
  WHERE i.id = p_invoice_id AND i.tenant_id = p_tenant_id;

  RETURN QUERY
  SELECT i.id, i.tenant_id, i.student_id, i.academic_year_id, i.fee_structure_id, i.status,
         i.currency, i.issued_at, i.voided_at, i.issue_journal_entry_id, i.created_at, i.updated_at
  FROM invoices i WHERE i.id = p_invoice_id;
END;
$$;

-- app.post_manual_payment: records a succeeded manual payment attempt, posts
-- the Dr cash/mobile_money_clearing / Cr fees_receivable journal, allocates
-- the full amount against the invoice, and issues a receipt.
--
-- Return shape is NOT the bare `payment_attempts` row: it is the payment
-- columns from ACF-012's Payment allowlist (id, tenant_id, invoice_id,
-- method, amount_minor, currency, status, created_at, updated_at) PLUS
-- receipt_id and receipt_number appended from the newly created `receipts`
-- row, so callers get payment + receipt in one round trip.
CREATE OR REPLACE FUNCTION app.post_manual_payment(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_payment_id uuid,
  p_receipt_id uuid,
  p_invoice_id uuid,
  p_method text,
  p_amount_minor bigint,
  p_currency text
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  invoice_id uuid,
  method text,
  amount_minor bigint,
  currency text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  receipt_id uuid,
  receipt_number text
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
  v_new_balance_minor bigint;
  v_debit_code text;
  v_debit_account_id uuid;
  v_credit_account_id uuid;
  v_journal_entry_id uuid;
  v_receipt_number text;
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_payment_id IS NULL
     OR p_receipt_id IS NULL OR p_invoice_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF p_method IS NULL OR p_method NOT IN ('cash', 'bank', 'cheque', 'other', 'mobile_money') THEN
    RAISE EXCEPTION 'invalid method' USING ERRCODE = '22023';
  END IF;
  IF p_amount_minor IS NULL OR p_amount_minor <= 0 THEN
    RAISE EXCEPTION 'invalid amount_minor' USING ERRCODE = '22023';
  END IF;
  IF p_currency IS NULL OR p_currency <> 'TZS' THEN
    RAISE EXCEPTION 'invalid currency' USING ERRCODE = '22023';
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

  PERFORM app.ensure_tenant_coa(p_tenant_id);

  v_debit_code := CASE WHEN p_method = 'mobile_money' THEN 'mobile_money_clearing' ELSE 'cash' END;

  SELECT coa.id INTO v_debit_account_id
  FROM chart_of_accounts coa
  WHERE coa.tenant_id = p_tenant_id AND coa.code = v_debit_code;
  SELECT coa.id INTO v_credit_account_id
  FROM chart_of_accounts coa
  WHERE coa.tenant_id = p_tenant_id AND coa.code = 'fees_receivable';

  v_journal_entry_id := gen_random_uuid();

  INSERT INTO journal_entries (
    id, tenant_id, posted_at, reference_type, reference_id, created_by_user_id, created_at
  ) VALUES (
    v_journal_entry_id, p_tenant_id, now(), 'payment', p_payment_id, p_actor_user_id, now()
  );

  INSERT INTO journal_lines (
    id, tenant_id, journal_entry_id, account_id, debit_minor, credit_minor, currency, created_at
  ) VALUES
    (gen_random_uuid(), p_tenant_id, v_journal_entry_id, v_debit_account_id, p_amount_minor, 0, p_currency, now()),
    (gen_random_uuid(), p_tenant_id, v_journal_entry_id, v_credit_account_id, 0, p_amount_minor, p_currency, now());

  INSERT INTO payment_attempts (
    id, tenant_id, invoice_id, method, amount_minor, currency, status, journal_entry_id,
    created_by_user_id, created_at, updated_at
  ) VALUES (
    p_payment_id, p_tenant_id, p_invoice_id, p_method, p_amount_minor, p_currency, 'succeeded',
    v_journal_entry_id, p_actor_user_id, now(), now()
  );

  -- v1: allocate the full amount against the invoice as a whole; per-line
  -- allocation (invoice_line_id) is left NULL and deferred to a later wave.
  INSERT INTO payment_allocations (
    id, tenant_id, payment_attempt_id, invoice_id, invoice_line_id, amount_minor, status, created_at
  ) VALUES (
    gen_random_uuid(), p_tenant_id, p_payment_id, p_invoice_id, NULL, p_amount_minor, 'active', now()
  );

  v_receipt_number := 'R-' || replace(p_payment_id::text, '-', '');

  INSERT INTO receipts (
    id, tenant_id, payment_attempt_id, receipt_number, status, issued_at, created_at
  ) VALUES (
    p_receipt_id, p_tenant_id, p_payment_id, v_receipt_number, 'issued', now(), now()
  );

  v_new_balance_minor := v_balance_minor - p_amount_minor;

  UPDATE invoices i SET
    status = CASE WHEN v_new_balance_minor = 0 THEN 'paid' ELSE 'partially_paid' END,
    updated_at = now()
  WHERE i.id = p_invoice_id AND i.tenant_id = p_tenant_id;

  RETURN QUERY
  SELECT pa.id, pa.tenant_id, pa.invoice_id, pa.method, pa.amount_minor, pa.currency, pa.status,
         pa.created_at, pa.updated_at, r.id AS receipt_id, r.receipt_number
  FROM payment_attempts pa
  JOIN receipts r ON r.payment_attempt_id = pa.id
  WHERE pa.id = p_payment_id;
END;
$$;

COMMENT ON FUNCTION app.post_manual_payment(uuid, uuid, uuid, uuid, uuid, text, bigint, text) IS
  'Returns ACF-012 Payment columns (id, tenant_id, invoice_id, method, amount_minor, '
  'currency, status, created_at, updated_at) plus receipt_id/receipt_number from the '
  'receipt issued in the same call.';

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT EXECUTE ON FUNCTION app.ensure_tenant_coa(uuid) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.create_fee_structure(
      uuid, uuid, uuid, uuid, text, text, text, jsonb
    ) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.create_invoice_draft(
      uuid, uuid, uuid, uuid, uuid, uuid, jsonb
    ) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.issue_invoice(uuid, uuid, uuid) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.post_manual_payment(
      uuid, uuid, uuid, uuid, uuid, text, bigint, text
    ) TO educore_app;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION app.ensure_tenant_coa(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.create_fee_structure(
  uuid, uuid, uuid, uuid, text, text, text, jsonb
) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.create_invoice_draft(
  uuid, uuid, uuid, uuid, uuid, uuid, jsonb
) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.issue_invoice(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.post_manual_payment(
  uuid, uuid, uuid, uuid, uuid, text, bigint, text
) FROM PUBLIC;
