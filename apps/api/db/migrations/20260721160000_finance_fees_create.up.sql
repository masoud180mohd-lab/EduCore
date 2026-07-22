-- IMP-009-A0 / DBF-012: finance core tables + finance.* permissions.
-- educore_app is SELECT-only; money writes via later SECURITY DEFINER helpers.

CREATE TABLE chart_of_accounts (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  code text NOT NULL,
  name text NOT NULL,
  account_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_coa_code CHECK (
    code IN ('fees_receivable', 'cash', 'mobile_money_clearing', 'fee_revenue')
  ),
  CONSTRAINT ck_coa_type CHECK (
    account_type IN ('asset', 'income', 'liability', 'expense')
  ),
  CONSTRAINT uq_coa_tenant_code UNIQUE (tenant_id, code)
);

CREATE TABLE fee_structures (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  academic_year_id uuid NOT NULL REFERENCES academic_years (id),
  name text NOT NULL,
  status text NOT NULL,
  currency text NOT NULL DEFAULT 'TZS',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_fee_structures_name_len CHECK (char_length(name) BETWEEN 1 AND 200),
  CONSTRAINT ck_fee_structures_status CHECK (status IN ('draft', 'active', 'archived')),
  CONSTRAINT ck_fee_structures_currency CHECK (currency = 'TZS')
);

CREATE INDEX ix_fee_structures_tenant_year ON fee_structures (tenant_id, academic_year_id);

CREATE TABLE fee_structure_items (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  fee_structure_id uuid NOT NULL REFERENCES fee_structures (id) ON DELETE CASCADE,
  name text NOT NULL,
  amount_minor bigint NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_fee_structure_items_name_len CHECK (char_length(name) BETWEEN 1 AND 200),
  CONSTRAINT ck_fee_structure_items_amount CHECK (amount_minor > 0)
);

CREATE INDEX ix_fee_structure_items_structure ON fee_structure_items (tenant_id, fee_structure_id);

CREATE TABLE journal_entries (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  posted_at timestamptz NOT NULL DEFAULT now(),
  reference_type text NOT NULL,
  reference_id uuid NOT NULL,
  memo text NULL,
  created_by_user_id uuid NULL REFERENCES users (id),
  reversing_entry_id uuid NULL REFERENCES journal_entries (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_journal_entries_ref_type CHECK (
    reference_type IN ('invoice_issue', 'payment', 'payment_reverse', 'invoice_void')
  )
);

CREATE INDEX ix_journal_entries_tenant_ref ON journal_entries (tenant_id, reference_type, reference_id);

CREATE TABLE journal_lines (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  journal_entry_id uuid NOT NULL REFERENCES journal_entries (id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES chart_of_accounts (id),
  debit_minor bigint NOT NULL DEFAULT 0,
  credit_minor bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TZS',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_journal_lines_one_side CHECK (
    (debit_minor > 0 AND credit_minor = 0) OR (credit_minor > 0 AND debit_minor = 0)
  ),
  CONSTRAINT ck_journal_lines_currency CHECK (currency = 'TZS')
);

CREATE INDEX ix_journal_lines_entry ON journal_lines (tenant_id, journal_entry_id);

CREATE TABLE invoices (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  student_id uuid NOT NULL REFERENCES students (id),
  academic_year_id uuid NOT NULL REFERENCES academic_years (id),
  fee_structure_id uuid NULL REFERENCES fee_structures (id),
  status text NOT NULL,
  currency text NOT NULL DEFAULT 'TZS',
  issued_at timestamptz NULL,
  voided_at timestamptz NULL,
  issue_journal_entry_id uuid NULL REFERENCES journal_entries (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_invoices_status CHECK (
    status IN ('draft', 'issued', 'partially_paid', 'paid', 'void')
  ),
  CONSTRAINT ck_invoices_currency CHECK (currency = 'TZS')
);

CREATE INDEX ix_invoices_tenant_issued ON invoices (tenant_id, issued_at DESC NULLS LAST, id ASC);
CREATE INDEX ix_invoices_tenant_student ON invoices (tenant_id, student_id);

CREATE TABLE invoice_lines (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  invoice_id uuid NOT NULL REFERENCES invoices (id) ON DELETE CASCADE,
  description text NOT NULL,
  amount_minor bigint NOT NULL,
  fee_structure_item_id uuid NULL REFERENCES fee_structure_items (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_invoice_lines_desc_len CHECK (char_length(description) BETWEEN 1 AND 200),
  CONSTRAINT ck_invoice_lines_amount CHECK (amount_minor > 0)
);

CREATE INDEX ix_invoice_lines_invoice ON invoice_lines (tenant_id, invoice_id);

CREATE TABLE payment_attempts (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  invoice_id uuid NOT NULL REFERENCES invoices (id),
  method text NOT NULL,
  amount_minor bigint NOT NULL,
  currency text NOT NULL DEFAULT 'TZS',
  status text NOT NULL,
  provider_code text NULL,
  provider_ref text NULL,
  journal_entry_id uuid NULL REFERENCES journal_entries (id),
  created_by_user_id uuid NULL REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_payment_attempts_method CHECK (
    method IN ('cash', 'bank', 'cheque', 'other', 'mobile_money')
  ),
  CONSTRAINT ck_payment_attempts_amount CHECK (amount_minor > 0),
  CONSTRAINT ck_payment_attempts_status CHECK (
    status IN (
      'created', 'initiated', 'pending', 'succeeded', 'failed',
      'expired', 'reversed', 'disputed'
    )
  ),
  CONSTRAINT ck_payment_attempts_currency CHECK (currency = 'TZS')
);

CREATE INDEX ix_payment_attempts_tenant_invoice ON payment_attempts (tenant_id, invoice_id);

CREATE TABLE payment_allocations (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  payment_attempt_id uuid NOT NULL REFERENCES payment_attempts (id),
  invoice_id uuid NOT NULL REFERENCES invoices (id),
  invoice_line_id uuid NULL REFERENCES invoice_lines (id),
  amount_minor bigint NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_payment_allocations_amount CHECK (amount_minor > 0),
  CONSTRAINT ck_payment_allocations_status CHECK (status IN ('active', 'reversed'))
);

CREATE INDEX ix_payment_allocations_invoice ON payment_allocations (tenant_id, invoice_id);

CREATE TABLE receipts (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  payment_attempt_id uuid NOT NULL REFERENCES payment_attempts (id),
  receipt_number text NOT NULL,
  status text NOT NULL DEFAULT 'issued',
  issued_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_receipts_payment UNIQUE (payment_attempt_id),
  CONSTRAINT uq_receipts_tenant_number UNIQUE (tenant_id, receipt_number),
  CONSTRAINT ck_receipts_status CHECK (status IN ('issued', 'reversed'))
);

CREATE INDEX ix_receipts_tenant_issued ON receipts (tenant_id, issued_at DESC, id ASC);

CREATE TABLE payment_gateway_events (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  provider_code text NOT NULL,
  provider_event_id text NOT NULL,
  payload_sha256 text NOT NULL,
  processing_status text NOT NULL DEFAULT 'received',
  payment_attempt_id uuid NULL REFERENCES payment_attempts (id),
  received_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_gateway_events_provider UNIQUE (tenant_id, provider_code, provider_event_id),
  CONSTRAINT ck_gateway_events_status CHECK (
    processing_status IN ('received', 'processed', 'ignored', 'failed')
  )
);

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT SELECT ON TABLE chart_of_accounts, fee_structures, fee_structure_items,
      journal_entries, journal_lines, invoices, invoice_lines, payment_attempts,
      payment_allocations, receipts, payment_gateway_events TO educore_app;
    REVOKE INSERT, UPDATE, DELETE ON TABLE chart_of_accounts, fee_structures, fee_structure_items,
      journal_entries, journal_lines, invoices, invoice_lines, payment_attempts,
      payment_allocations, receipts, payment_gateway_events FROM educore_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_platform') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE chart_of_accounts, fee_structures, fee_structure_items,
      journal_entries, journal_lines, invoices, invoice_lines, payment_attempts,
      payment_allocations, receipts, payment_gateway_events TO educore_platform;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_migrator') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE chart_of_accounts, fee_structures, fee_structure_items,
      journal_entries, journal_lines, invoices, invoice_lines, payment_attempts,
      payment_allocations, receipts, payment_gateway_events TO educore_migrator;
  END IF;
END
$$;

REVOKE ALL ON TABLE chart_of_accounts, fee_structures, fee_structure_items,
  journal_entries, journal_lines, invoices, invoice_lines, payment_attempts,
  payment_allocations, receipts, payment_gateway_events FROM PUBLIC;

SELECT app.enable_tenant_rls('chart_of_accounts'::regclass);
SELECT app.enable_tenant_rls('fee_structures'::regclass);
SELECT app.enable_tenant_rls('fee_structure_items'::regclass);
SELECT app.enable_tenant_rls('journal_entries'::regclass);
SELECT app.enable_tenant_rls('journal_lines'::regclass);
SELECT app.enable_tenant_rls('invoices'::regclass);
SELECT app.enable_tenant_rls('invoice_lines'::regclass);
SELECT app.enable_tenant_rls('payment_attempts'::regclass);
SELECT app.enable_tenant_rls('payment_allocations'::regclass);
SELECT app.enable_tenant_rls('receipts'::regclass);
SELECT app.enable_tenant_rls('payment_gateway_events'::regclass);

CREATE POLICY rls_coa_select ON chart_of_accounts FOR SELECT TO educore_app
  USING (tenant_id = app.current_tenant_id());
CREATE POLICY rls_fee_structures_select ON fee_structures FOR SELECT TO educore_app
  USING (tenant_id = app.current_tenant_id());
CREATE POLICY rls_fee_structure_items_select ON fee_structure_items FOR SELECT TO educore_app
  USING (tenant_id = app.current_tenant_id());
CREATE POLICY rls_journal_entries_select ON journal_entries FOR SELECT TO educore_app
  USING (tenant_id = app.current_tenant_id());
CREATE POLICY rls_journal_lines_select ON journal_lines FOR SELECT TO educore_app
  USING (tenant_id = app.current_tenant_id());
CREATE POLICY rls_invoices_select ON invoices FOR SELECT TO educore_app
  USING (tenant_id = app.current_tenant_id());
CREATE POLICY rls_invoice_lines_select ON invoice_lines FOR SELECT TO educore_app
  USING (tenant_id = app.current_tenant_id());
CREATE POLICY rls_payment_attempts_select ON payment_attempts FOR SELECT TO educore_app
  USING (tenant_id = app.current_tenant_id());
CREATE POLICY rls_payment_allocations_select ON payment_allocations FOR SELECT TO educore_app
  USING (tenant_id = app.current_tenant_id());
CREATE POLICY rls_receipts_select ON receipts FOR SELECT TO educore_app
  USING (tenant_id = app.current_tenant_id());
CREATE POLICY rls_gateway_events_select ON payment_gateway_events FOR SELECT TO educore_app
  USING (tenant_id = app.current_tenant_id());

INSERT INTO permissions (id, code, description) VALUES
  ('01900000-0001-7000-8000-000000000040', 'finance.read', 'Read fee structures, invoices, payments, receipts'),
  ('01900000-0001-7000-8000-000000000041', 'finance.manage', 'Create structures/invoices and record manual payments'),
  ('01900000-0001-7000-8000-000000000042', 'finance.reconcile', 'Reconcile payment attempts against gateway events')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, now()
FROM roles r
CROSS JOIN permissions p
WHERE r.is_system = true
  AND (
    (r.code IN ('owner', 'admin', 'staff') AND p.code IN ('finance.read', 'finance.manage'))
    OR (r.code IN ('owner', 'admin') AND p.code = 'finance.reconcile')
  )
ON CONFLICT DO NOTHING;
