# IMP-009 — Fees / Finance Ledger + Payments foundation

| Field     | Value                                              |
| --------- | -------------------------------------------------- |
| Program   | **IMP-009**                                        |
| Prompt ID | IMP-007 (collides with Admin/Guardians — remapped) |
| Date      | 2026-07-22 (Waves A–H)                             |
| Freezes   | DBF-012 / ACF-012 (rev 1.2)                        |
| Authority | Solo-operator provisional                          |

## Discovery

| Dependency                        | Status                                                                |
| --------------------------------- | --------------------------------------------------------------------- |
| Students list/detail/create/patch | Green (IMP-002)                                                       |
| Academic years                    | Green (IMP-003)                                                       |
| Enrollments                       | Green (IMP-004) — invoice targets **studentId** (enrollment optional) |
| finance-ledger / payments modules | Product surfaces shipped (skeletons retained)                         |
| Finance migrations                | `20260721160000`…`60300` (schema + helpers + void/reverse + gateway)  |
| Provider                          | Fake only — [PAY-PROVIDER-001](../decisions/PAY-PROVIDER-001.md)      |

## Ledger policy

Revenue on **invoice issue** (Dr receivable / Cr revenue). Cash posts Cr receivable. No writable balance.

## Waves

| Wave  | Work                             | Status |
| ----- | -------------------------------- | ------ |
| A0    | Freezes + schema + perms + CoA   | Done   |
| A1/A2 | Structures + invoices GET        | Done   |
| B     | Create structure + draft/issue   | Done   |
| C     | Manual payment + receipts        | Done   |
| D     | Void / reverse                   | Done   |
| G     | Fake provider + events (minimal) | Done   |
| H     | OpenAPI + AuthZ tooling + review | Done   |
| R     | Reconcile (`finance.reconcile`)  | Done   |

### Wave D — Void / reverse

- Migration `20260721160200_finance_void_reverse_helpers` adds `app.void_invoice` and `app.reverse_payment` SECURITY DEFINER helpers (educore_app EXECUTE only; PUBLIC revoked).
- `app.void_invoice`: allowed only for `issued` invoices with zero active `payment_allocations` (409 for partially_paid/paid); posts a reversing journal for the issue entry and sets `status='void'`.
- `app.reverse_payment`: allowed only for `succeeded` payments; posts a reversing journal, marks allocations/receipt `reversed`, and recomputes invoice status from remaining active allocations.
- `FinanceRepository.voidInvoice` / `PaymentAttemptsRepository.reversePayment` call the helpers; `InvoicesService.voidForTenant` / `PaymentsService.reverseForTenant` add idempotent product-service wrappers (same pattern as `issueForTenant`).
- `POST /api/v1/invoices/{id}/void` and `POST /api/v1/payments/{id}/reverse` — both `finance.manage` + `Idempotency-Key`, `HttpCode(200)`.
- `FinanceRepository`'s computed `balanceMinor` now forces `0` for `status='void'` invoices (see ACF-012 rev 1.1).
- Unit tests: `invoices.service.test.ts` (void idempotency/404/conflict/forbidden/success/replay), `payments.service.test.ts` (reverse idempotency/404/conflict/forbidden/success/replay).

### Wave G — Fake provider + events (minimal)

- `PaymentsModule` binds `PAYMENT_PROVIDER_PORT` to `FakePaymentProvider` (`useExisting`); no real MoMo vendor (PAY-PROVIDER-001).
- Migration `20260721160300_finance_gateway_event_helpers` adds `app.record_gateway_event`, a SECURITY DEFINER dedupe helper over `payment_gateway_events`' unique `(tenant_id, provider_code, provider_event_id)` constraint (`ON CONFLICT DO NOTHING`).
- `PaymentAttemptsRepository.recordGatewayEvent` calls the helper; `PaymentsService.handleFakeWebhookForTenant` validates the body and reports `{ accepted: true, duplicate }`.
- `POST /api/v1/payments/webhooks/fake` (new `PaymentsWebhooksController`) — `finance.manage`, no `Idempotency-Key` header (dedupe is by `eventId` against the DB constraint, which is the real idempotency guard here).
- Deliberately does **not** invoke a payment-completion path: no gateway-initiated pending-payment flow exists yet in Waves A–C (manual payments always post as `succeeded` immediately), so inventing one was out of scope per the minimal v1 slice.
- Unit tests: `payments.service.test.ts` (unknown fields, invalid outcome, first-seen vs duplicate event, two-call dedupe sequence).

### Wave H — OpenAPI + tooling + review

- OpenAPI: `docs/engineering/api-contract-freeze/openapi/acf-012-finance-fees.openapi.yaml` (rev 1.2 paths + AuthZ extensions).
- Index: DBF README + ACF README list DBF-012 / ACF-012.
- Structural tooling: `tests/tooling/imp009-finance-fees.test.ts` (freezes, permissions, SELECT-only, DEFINER helpers, Fake DI, OpenAPI path matrix).
- HTTP AuthZ: `tests/integration/product-reads-authz.http.test.ts` covers finance.read/manage/reconcile fail-closed + idempotency.

### Wave R — Reconcile

- Migration `20260721160400_finance_reconcile_helpers` adds `payment_reconciliations`, gateway event amount/outcome columns, and `app.reconcile_payment`.
- `POST /api/v1/payments/{id}/reconcile` — `finance.reconcile` + Idempotency-Key; records matched / amount_mismatch / missing_event / status_mismatch without mutating ledger.
- Unit tests cover idempotency/404/success; OpenAPI ACF-012 rev 1.3.

## Residual risks (honest)

- Fake webhook stores events only; does **not** complete pending gateway attempts (no initiate→pending product path yet).
- Parent pay UX and multi-currency out of scope; real MoMo blocked on superseding PAY-PROVIDER brief.
- Existing tenants need `npm run db:migrate` (+ `rbac:reconcile-grants` if finance.* grants missing).
