# API Contract Freeze — Finance / Fees (ACF-012)

| Field     | Value                                     |
| --------- | ----------------------------------------- |
| Freeze ID | `ACF-012`                                 |
| Version   | `1.5`                                     |
| Date      | 2026-07-31 (rev 1.5 MoMo contract preview; 1.4 on 2026-07-26) |
| Companion | DBF-012                                   |
| Program   | **IMP-009** (prompt IMP-007 ID collision) |
| Authority | Solo-operator provisional (SOLO-GOV-001)  |

**Honesty:** Provisional. Prompt’s “ACF-010 finance” maps here — repo ACF-010 is guardians.

## Scope (v1)

| In scope                                   | Out of scope                       |
| ------------------------------------------ | ---------------------------------- |
| Fee structures list/get/create/patch       | Parent portal pay UI               |
| Invoices list/get/create/issue/void        | Selcom; USSD Push; cards; payouts  |
| Manual payment + receipt + reverse         | Multi-currency beyond TZS          |
| Derived `balanceMinor` on invoice get/list | Writable balance column            |
| Fake webhook event store + reconcile       | Completing pending via Fake webhook |
| **PAY-002 contract:** ClickPesa BillPay (HTTP not shipped) | Parent portal pay UI |

## Money

- All amounts: integer **minor units** (`amountMinor`); reject floats
- Currency: `TZS` only in v1

## Endpoints

| Method | Path                              | AuthZ                                                        |
| ------ | --------------------------------- | ------------------------------------------------------------ |
| GET    | `/api/v1/fee-structures`          | finance.read                                                 |
| GET    | `/api/v1/fee-structures/{id}`     | finance.read                                                 |
| POST   | `/api/v1/fee-structures`          | finance.manage + Idempotency-Key                             |
| PATCH  | `/api/v1/fee-structures/{id}`     | finance.manage + optional Idempotency-Key                    |
| GET    | `/api/v1/invoices`                | finance.read                                                 |
| GET    | `/api/v1/invoices/{id}`           | finance.read                                                 |
| POST   | `/api/v1/invoices`                | finance.manage + Idempotency-Key                             |
| POST   | `/api/v1/invoices/{id}/issue`     | finance.manage + Idempotency-Key                             |
| POST   | `/api/v1/invoices/{id}/void`      | finance.manage + Idempotency-Key                             |
| POST   | `/api/v1/payments`                | finance.manage + Idempotency-Key                             |
| GET    | `/api/v1/payments/{id}`           | finance.read                                                 |
| POST   | `/api/v1/payments/{id}/reverse`   | finance.manage + Idempotency-Key                             |
| POST   | `/api/v1/payments/{id}/reconcile` | finance.reconcile + Idempotency-Key                          |
| GET    | `/api/v1/invoices/{id}/payments`  | finance.read                                                 |
| GET    | `/api/v1/receipts`                | finance.read                                                 |
| GET    | `/api/v1/receipts/{id}`           | finance.read                                                 |
| POST   | `/api/v1/payments/webhooks/fake`  | finance.manage (no Idempotency-Key — dedupe is by `eventId`) |

## Allowlists

**FeeStructure:** id, tenantId, academicYearId, name, status, currency, createdAt, updatedAt (+ items on detail)

**FeeStructureItem:** id, feeStructureId, name, amountMinor, sortOrder

**Invoice:** id, tenantId, studentId, academicYearId, feeStructureId, status, currency, totalMinor, balanceMinor, issuedAt, createdAt, updatedAt (+ lines on detail)

**InvoiceLine:** id, invoiceId, description, amountMinor, feeStructureItemId

**Payment:** id, tenantId, invoiceId, method, amountMinor, currency, status, receiptId, createdAt, updatedAt

**Receipt:** id, tenantId, paymentAttemptId, receiptNumber, status, issuedAt

**Reconciliation:** id, tenantId, paymentAttemptId, gatewayEventId, outcome (`matched`\|`amount_mismatch`\|`missing_event`\|`status_mismatch`), attemptAmountMinor, attemptStatus, eventAmountMinor, eventOutcome, createdAt

## Ledger policy cite

Revenue recognized **on issue** (DBF-012). Receipt only after succeeded payment + balanced journal. Corrections are reversals only — void/reverse never mutate posted journal lines. Reconcile is **read/compare + audit row only** — it does not post ledger.

## Rev 1.1 — Void / reverse (Wave D)

- `POST /api/v1/invoices/{id}/void` — voids an `issued` invoice with **zero active `payment_allocations`**; blocked (409) for `partially_paid`/`paid`.
- `POST /api/v1/payments/{id}/reverse` — reverses a `succeeded` payment; recomputes invoice status. Blocked (409) if not `succeeded`.

## Rev 1.2 — Fake webhook stub (Wave G)

- `POST /api/v1/payments/webhooks/fake` — Fake-provider-only (PAY-PROVIDER-001). Stores/dedupes events; does **not** complete pending payments.

## Rev 1.3 — Reconcile (Wave R)

- `POST /api/v1/payments/{id}/reconcile` — `finance.reconcile` + `Idempotency-Key`, `HttpCode(200)`.
- Compares attempt amount/status vs latest linked gateway event; writes immutable `payment_reconciliations` row.
- Outcomes: `matched`, `amount_mismatch`, `missing_event`, `status_mismatch`. Does not mutate payment or ledger.

## Rev 1.4 — Fee structure amend (IMP-024)

- `PATCH /api/v1/fee-structures/{id}` — `finance.manage`, optional `Idempotency-Key`, and `200` fee structure detail with items.
- Allows any non-empty subset of `name`, `status`, and `items`; unknown fields are rejected.
- `items` is a full replacement. Replacement is blocked with `409 CONFLICT` when an invoice line references a current item.

## Rev 1.5 — ClickPesa MoMo contract preview (PAY-002)

Binding semantics: `docs/engineering/decisions/PAY-002-clickpesa-adapter-contract.md`. **HTTP routes below are not live until PAY-004.**

| Method | Path | AuthZ (planned) |
| ------ | ---- | --------------- |
| POST | `/api/v1/payments/mobile-money` | finance.manage + Idempotency-Key — create `mobile_money` attempt + BillPay number |
| POST | `/api/v1/payments/webhooks/clickpesa` | No session; HMAC-SHA256 checksum (ClickPesa); tenant from attempt id |

- Amounts: EduCore minor; ClickPesa major TZS (÷/× 100); reject non-divisible initiate.
- Dedupe: `(tenant_id, provider_code=clickpesa, provider_event_id=data.id)`.
- Fake webhook path retained for CI.

## Solo-operator honesty

Provisional for IMP-009 / EPIC-PAY-01.
