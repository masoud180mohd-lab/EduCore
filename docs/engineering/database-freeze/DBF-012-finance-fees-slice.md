# Database Freeze — Finance fees + ledger (DBF-012)

| Field     | Value                                                                    |
| --------- | ------------------------------------------------------------------------ |
| Freeze ID | `DBF-012`                                                                |
| Version   | `1.3`                                                                    |
| Date      | 2026-07-22 (rev 1.3 reconcile; 1.1/1.2 void/gateway; v1.0 on 2026-07-21) |
| Companion | ACF-012                                                                  |
| Program   | **IMP-009** (prompt labeled IMP-007; that ID is already Admin/Guardians) |
| Authority | Solo-operator provisional (SOLO-GOV-001)                                 |

**Honesty:** Provisional. Supersedes prompt’s “DBF-010 finance” numbering — repo DBF-010 is guardians.

## Ledger policy (locked)

**Revenue on invoice issue:** when an invoice transitions `draft` → `issued`, post one balanced journal:

- Dr `fees_receivable` (asset)
- Cr `fee_revenue` (income)

for the full invoice total in minor units.

**Cash collection:** manual/gateway success posts:

- Dr `cash` or `mobile_money_clearing` (by method)
- Cr `fees_receivable`

and writes `payment_allocations` + `receipts`. **Never** mutate a stored balance column as truth.

**Corrections:** reversals only (new reversing journal + reverse allocations); no UPDATE of posted journal lines.

## Tables (v1)

### `chart_of_accounts`

| Column       | Type        | Notes                                                                                |
| ------------ | ----------- | ------------------------------------------------------------------------------------ |
| id           | uuid PK     |                                                                                      |
| tenant_id    | uuid FK     | RLS                                                                                  |
| code         | text        | unique per tenant: `fees_receivable`, `cash`, `mobile_money_clearing`, `fee_revenue` |
| name         | text        |                                                                                      |
| account_type | text        | `asset` \| `income` \| `liability` \| `expense`                                      |
| created_at   | timestamptz |                                                                                      |

### `fee_structures` / `fee_structure_items`

- structure: tenant_id, academic_year_id, name (1–200), status (`draft`\|`active`\|`archived`), currency (`TZS`), timestamps
- items: structure_id, name, amount_minor (bigint > 0), sort_order

### `invoices` / `invoice_lines`

- invoice: student_id, academic_year_id, currency, status (`draft`\|`issued`\|`partially_paid`\|`paid`\|`void`), issued_at, voided_at, fee_structure_id NULL, journal_entry_id NULL, timestamps
- **No balance column.**
- lines: invoice_id, description, amount_minor, fee_structure_item_id NULL

### `journal_entries` / `journal_lines`

- entry: tenant_id, posted_at, reference_type, reference_id, memo, created_by_user_id, reversing_entry_id NULL
- lines: entry_id, account_id, debit_minor, credit_minor (exactly one side > 0), currency
- CHECK entry balances (sum debit = sum credit) enforced in helper

### `payment_attempts`

- invoice_id, method (`cash`\|`bank`\|`cheque`\|`other`\|`mobile_money`), amount_minor, currency, status, provider_code NULL, provider_ref NULL, journal_entry_id NULL, timestamps

### `payment_allocations`

- payment_attempt_id, invoice_id, invoice_line_id NULL, amount_minor, status (`active`\|`reversed`)

### `receipts`

- payment_attempt_id UNIQUE, receipt_number (unique per tenant), issued_at, status (`issued`\|`reversed`)

### `payment_gateway_events` (Wave G)

- provider_code, provider_event_id UNIQUE (tenant, provider, event_id), payload_sha256, received_at, processing_status

## Privileges

- `educore_app`: SELECT only on all finance tables
- Writes via SECURITY DEFINER helpers only

## Permissions

- `finance.read` — owner, admin, staff
- `finance.manage` — owner, admin, staff
- `finance.reconcile` — owner, admin only

## Rev 1.1 — Void / reverse helpers (Wave D, migration `20260721160200`)

- `app.void_invoice(actor, tenant, invoice_id)` — `issued` + zero active `payment_allocations` only; posts a reversing `invoice_void` journal (swap Dr/Cr of the issue journal) and sets `status='void'`, `voided_at`.
- `app.reverse_payment(actor, tenant, payment_id)` — `succeeded` only; posts a reversing `payment_reverse` journal, marks the allocation(s) `reversed` and the receipt `reversed`, then recomputes invoice status from remaining active allocations vs. total lines.
- No new tables or columns — `journal_entries.reference_type` already allowed `invoice_void`/`payment_reverse` and `reversing_entry_id` in v1.0; both helpers were additive functions only.
- `educore_app`: EXECUTE granted on both functions; PUBLIC revoked (same privilege pattern as v1.0 helpers).

## Rev 1.2 — Gateway event dedupe helper (Wave G, migration `20260721160300`)

- `app.record_gateway_event(actor, tenant, gateway_event_id, provider_code, provider_event_id, payload_sha256, payment_attempt_id)` — inserts into `payment_gateway_events` with `ON CONFLICT (tenant_id, provider_code, provider_event_id) DO NOTHING`; returns `(id, inserted)` so the caller can report `duplicate = NOT inserted`.
- No new tables or columns — `payment_gateway_events` and its unique constraint were already defined in v1.0's `20260721160000_finance_fees_create`.
- `educore_app`: EXECUTE granted; PUBLIC revoked.
- Provider binding: `PAYMENT_PROVIDER_PORT` resolves to `FakePaymentProvider` only (PAY-PROVIDER-001) — no schema impact.

## Rev 1.3 — Reconcile (Wave R, migration `20260721160400`)

- Columns on `payment_gateway_events`: `amount_minor`, `provider_outcome` (for amount/status compare).
- Table `payment_reconciliations` — immutable audit of compare outcomes; SELECT-only for `educore_app`.
- `app.record_gateway_event` 9-arg overload (amount + outcome); prior 7-arg dropped.
- `app.reconcile_payment` — compare attempt vs latest linked event; outcomes `matched` | `amount_mismatch` | `missing_event` | `status_mismatch`. Does **not** post journals or mutate payment status.

## Rev 1.4 — F-016 payment_reconciliations RLS (migration `20260813150000`)

- `payment_reconciliations` now ENABLE + FORCE RLS via `app.enable_tenant_rls`.
- `educore_app` SELECT policy: `tenant_id = app.current_tenant_id()` (same pattern as other finance tables).
- PUBLIC revoked. Writes still only via `app.reconcile_payment` (SECURITY DEFINER).

## Solo-operator honesty

Acting seats only.
