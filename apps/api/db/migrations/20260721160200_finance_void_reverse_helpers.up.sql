-- IMP-009 Wave D / DBF-012 rev 1.1: void invoice + reverse payment helpers.
-- Corrections are reversals only (DBF-012 ledger policy) — these functions
-- post reversing journals (swap Dr/Cr) rather than mutating posted lines.

-- app.void_invoice: allowed only when the invoice is `issued` with zero
-- active payment_allocations (block partially_paid/paid). Posts a reversing
-- journal for the original issue journal and marks the invoice void.
CREATE OR REPLACE FUNCTION app.void_invoice(
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
  total_minor bigint,
  balance_minor bigint,
  issued_at timestamptz,
  voided_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  v_status text;
  v_issue_journal_entry_id uuid;
  v_total_minor bigint;
  v_has_active_allocations boolean;
  v_void_journal_entry_id uuid;
  v_debit_sum bigint;
  v_credit_sum bigint;
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_invoice_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;

  SELECT i.status, i.issue_journal_entry_id INTO v_status, v_issue_journal_entry_id
  FROM invoices i
  WHERE i.id = p_invoice_id AND i.tenant_id = p_tenant_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'invoice not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_status <> 'issued' THEN
    RAISE EXCEPTION 'invoice not voidable' USING ERRCODE = '55000';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM payment_allocations pal
    WHERE pal.invoice_id = p_invoice_id AND pal.tenant_id = p_tenant_id AND pal.status = 'active'
  ) INTO v_has_active_allocations;

  IF v_has_active_allocations THEN
    RAISE EXCEPTION 'invoice has active payments' USING ERRCODE = '55000';
  END IF;

  IF v_issue_journal_entry_id IS NULL THEN
    RAISE EXCEPTION 'invoice has no issue journal to reverse' USING ERRCODE = '55000';
  END IF;

  SELECT COALESCE(SUM(il.amount_minor), 0) INTO v_total_minor
  FROM invoice_lines il
  WHERE il.invoice_id = p_invoice_id AND il.tenant_id = p_tenant_id;

  v_void_journal_entry_id := gen_random_uuid();

  INSERT INTO journal_entries (
    id, tenant_id, posted_at, reference_type, reference_id, memo, created_by_user_id,
    reversing_entry_id, created_at
  ) VALUES (
    v_void_journal_entry_id, p_tenant_id, now(), 'invoice_void', p_invoice_id,
    'Reversal of issue journal ' || v_issue_journal_entry_id::text, p_actor_user_id,
    v_issue_journal_entry_id, now()
  );

  -- Swap debit/credit from the original issue journal to reverse it exactly.
  INSERT INTO journal_lines (
    id, tenant_id, journal_entry_id, account_id, debit_minor, credit_minor, currency, created_at
  )
  SELECT gen_random_uuid(), jl.tenant_id, v_void_journal_entry_id, jl.account_id,
         jl.credit_minor, jl.debit_minor, jl.currency, now()
  FROM journal_lines jl
  WHERE jl.journal_entry_id = v_issue_journal_entry_id AND jl.tenant_id = p_tenant_id;

  SELECT COALESCE(SUM(jl.debit_minor), 0), COALESCE(SUM(jl.credit_minor), 0)
  INTO v_debit_sum, v_credit_sum
  FROM journal_lines jl
  WHERE jl.journal_entry_id = v_void_journal_entry_id;

  IF v_debit_sum <> v_credit_sum THEN
    RAISE EXCEPTION 'journal entry not balanced' USING ERRCODE = '55000';
  END IF;

  UPDATE invoices i SET
    status = 'void',
    voided_at = now(),
    updated_at = now()
  WHERE i.id = p_invoice_id AND i.tenant_id = p_tenant_id;

  RETURN QUERY
  SELECT i.id, i.tenant_id, i.student_id, i.academic_year_id, i.fee_structure_id, i.status,
         i.currency, v_total_minor AS total_minor, 0::bigint AS balance_minor,
         i.issued_at, i.voided_at, i.created_at, i.updated_at
  FROM invoices i WHERE i.id = p_invoice_id;
END;
$$;

-- app.reverse_payment: allowed only when the payment is `succeeded`. Posts a
-- reversing journal (swap Dr/Cr), marks the payment/allocations/receipt
-- reversed, and recomputes the invoice status from the remaining active
-- allocations (issued if balance=total, partially_paid if some remaining,
-- paid if balance=0).
CREATE OR REPLACE FUNCTION app.reverse_payment(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_payment_id uuid
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
  receipt_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  v_status text;
  v_invoice_id uuid;
  v_journal_entry_id uuid;
  v_reverse_journal_entry_id uuid;
  v_debit_sum bigint;
  v_credit_sum bigint;
  v_total_minor bigint;
  v_remaining_allocated_minor bigint;
  v_new_status text;
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_payment_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;

  SELECT pa.status, pa.invoice_id, pa.journal_entry_id
  INTO v_status, v_invoice_id, v_journal_entry_id
  FROM payment_attempts pa
  WHERE pa.id = p_payment_id AND pa.tenant_id = p_tenant_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'payment not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_status <> 'succeeded' THEN
    RAISE EXCEPTION 'payment not reversible' USING ERRCODE = '55000';
  END IF;
  IF v_journal_entry_id IS NULL THEN
    RAISE EXCEPTION 'payment has no journal to reverse' USING ERRCODE = '55000';
  END IF;

  -- Lock the invoice row to serialize concurrent status recomputation.
  PERFORM 1 FROM invoices i WHERE i.id = v_invoice_id AND i.tenant_id = p_tenant_id FOR UPDATE;

  v_reverse_journal_entry_id := gen_random_uuid();

  INSERT INTO journal_entries (
    id, tenant_id, posted_at, reference_type, reference_id, memo, created_by_user_id,
    reversing_entry_id, created_at
  ) VALUES (
    v_reverse_journal_entry_id, p_tenant_id, now(), 'payment_reverse', p_payment_id,
    'Reversal of payment journal ' || v_journal_entry_id::text, p_actor_user_id,
    v_journal_entry_id, now()
  );

  INSERT INTO journal_lines (
    id, tenant_id, journal_entry_id, account_id, debit_minor, credit_minor, currency, created_at
  )
  SELECT gen_random_uuid(), jl.tenant_id, v_reverse_journal_entry_id, jl.account_id,
         jl.credit_minor, jl.debit_minor, jl.currency, now()
  FROM journal_lines jl
  WHERE jl.journal_entry_id = v_journal_entry_id AND jl.tenant_id = p_tenant_id;

  SELECT COALESCE(SUM(jl.debit_minor), 0), COALESCE(SUM(jl.credit_minor), 0)
  INTO v_debit_sum, v_credit_sum
  FROM journal_lines jl
  WHERE jl.journal_entry_id = v_reverse_journal_entry_id;

  IF v_debit_sum <> v_credit_sum THEN
    RAISE EXCEPTION 'journal entry not balanced' USING ERRCODE = '55000';
  END IF;

  UPDATE payment_attempts pa SET
    status = 'reversed',
    updated_at = now()
  WHERE pa.id = p_payment_id AND pa.tenant_id = p_tenant_id;

  UPDATE payment_allocations pal SET
    status = 'reversed'
  WHERE pal.payment_attempt_id = p_payment_id AND pal.tenant_id = p_tenant_id AND pal.status = 'active';

  UPDATE receipts r SET
    status = 'reversed'
  WHERE r.payment_attempt_id = p_payment_id AND r.tenant_id = p_tenant_id AND r.status = 'issued';

  SELECT COALESCE(SUM(il.amount_minor), 0) INTO v_total_minor
  FROM invoice_lines il
  WHERE il.invoice_id = v_invoice_id AND il.tenant_id = p_tenant_id;

  SELECT COALESCE(SUM(pal.amount_minor), 0) INTO v_remaining_allocated_minor
  FROM payment_allocations pal
  WHERE pal.invoice_id = v_invoice_id AND pal.tenant_id = p_tenant_id AND pal.status = 'active';

  IF v_remaining_allocated_minor <= 0 THEN
    v_new_status := 'issued';
  ELSIF v_remaining_allocated_minor >= v_total_minor THEN
    v_new_status := 'paid';
  ELSE
    v_new_status := 'partially_paid';
  END IF;

  -- Guard against reopening a void invoice; should not occur since void
  -- requires zero active allocations, but keep the recompute defensive.
  UPDATE invoices i SET
    status = v_new_status,
    updated_at = now()
  WHERE i.id = v_invoice_id AND i.tenant_id = p_tenant_id AND i.status <> 'void';

  RETURN QUERY
  SELECT pa.id, pa.tenant_id, pa.invoice_id, pa.method, pa.amount_minor, pa.currency, pa.status,
         pa.created_at, pa.updated_at, r.id AS receipt_id
  FROM payment_attempts pa
  LEFT JOIN receipts r ON r.payment_attempt_id = pa.id
  WHERE pa.id = p_payment_id;
END;
$$;

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT EXECUTE ON FUNCTION app.void_invoice(uuid, uuid, uuid) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.reverse_payment(uuid, uuid, uuid) TO educore_app;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION app.void_invoice(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.reverse_payment(uuid, uuid, uuid) FROM PUBLIC;
