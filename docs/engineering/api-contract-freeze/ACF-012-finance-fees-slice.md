# API Contract Freeze — Finance / Fees (ACF-012)

| Field     | Value                                     |
| --------- | ----------------------------------------- |
| Freeze ID | `ACF-012`                                 |
| Version   | `1.2`                                     |
| Date      | 2026-07-22                                |
| Companion | DBF-012                                   |
| Program   | **IMP-009** (prompt IMP-007 ID collision) |
| Authority | Solo-operator provisional (SOLO-GOV-001)  |

**Honesty:** Provisional. Prompt’s “ACF-010 finance” maps here — repo ACF-010 is guardians.

## Scope (v1.0 waves A–C)

| In scope                                   | Out of scope                      |
| ------------------------------------------ | --------------------------------- |
| Fee structures list/get/create             | Parent portal pay UI              |
| Invoices list/get/create/issue             | Real MoMo vendor                  |
| Manual payment + receipt                   | Multi-currency beyond TZS         |
| Derived `balanceMinor` on invoice get/list | Writable balance column           |
| Permissions finance.read/manage            | finance.reconcile routes (Wave R) |

## Money

- All amounts: integer **minor units** (`amountMinor`); reject floats
- Currency: `TZS` only in v1

## Endpoints

| Method | Path                             | AuthZ                                                        |
| ------ | -------------------------------- | ------------------------------------------------------------ |
| GET    | `/api/v1/fee-structures`         | finance.read                                                 |
| GET    | `/api/v1/fee-structures/{id}`    | finance.read                                                 |
| POST   | `/api/v1/fee-structures`         | finance.manage + Idempotency-Key                             |
| GET    | `/api/v1/invoices`               | finance.read                                                 |
| GET    | `/api/v1/invoices/{id}`          | finance.read                                                 |
| POST   | `/api/v1/invoices`               | finance.manage + Idempotency-Key                             |
| POST   | `/api/v1/invoices/{id}/issue`    | finance.manage + Idempotency-Key                             |
| POST   | `/api/v1/invoices/{id}/void`     | finance.manage + Idempotency-Key                             |
| POST   | `/api/v1/payments`               | finance.manage + Idempotency-Key                             |
| GET    | `/api/v1/payments/{id}`          | finance.read                                                 |
| POST   | `/api/v1/payments/{id}/reverse`  | finance.manage + Idempotency-Key                             |
| GET    | `/api/v1/invoices/{id}/payments` | finance.read                                                 |
| GET    | `/api/v1/receipts`               | finance.read                                                 |
| GET    | `/api/v1/receipts/{id}`          | finance.read                                                 |
| POST   | `/api/v1/payments/webhooks/fake` | finance.manage (no Idempotency-Key — dedupe is by `eventId`) |

Later revs: reconcile (1.3).

## Allowlists

**FeeStructure:** id, tenantId, academicYearId, name, status, currency, createdAt, updatedAt (+ items on detail)

**FeeStructureItem:** id, feeStructureId, name, amountMinor, sortOrder

**Invoice:** id, tenantId, studentId, academicYearId, feeStructureId, status, currency, totalMinor, balanceMinor, issuedAt, createdAt, updatedAt (+ lines on detail)

**InvoiceLine:** id, invoiceId, description, amountMinor, feeStructureItemId

**Payment:** id, tenantId, invoiceId, method, amountMinor, currency, status, receiptId, createdAt, updatedAt

**Receipt:** id, tenantId, paymentAttemptId, receiptNumber, status, issuedAt

## Ledger policy cite

Revenue recognized **on issue** (DBF-012). Receipt only after succeeded payment + balanced journal. Corrections are reversals only — void/reverse below never mutate posted journal lines.

## Rev 1.1 — Void / reverse (Wave D)

- `POST /api/v1/invoices/{id}/void` — voids an `issued` invoice with **zero active `payment_allocations`**; blocked (409) for `partially_paid`/`paid`. Posts a reversing journal for the original issue entry (swap Dr/Cr) and sets `status='void'`, `voidedAt`. Response `Invoice` reports `balanceMinor: 0` once void, regardless of the (necessarily zero) active allocations.
- `POST /api/v1/payments/{id}/reverse` — reverses a `succeeded` payment attempt: posts a reversing journal (swap Dr/Cr) for the payment journal, marks the allocation(s) and receipt `reversed`, and recomputes the invoice status from the remaining active allocations vs. total lines (`issued` if balance = total, `partially_paid` if some remaining, `paid` if balance = 0). Blocked (409) for payments not in `succeeded` status.
- Both endpoints require `finance.manage` + `Idempotency-Key`, `HttpCode(200)` (mutating an existing resource, not creating one).
- Allowlists unchanged; `Invoice.status` already included `void` and `Payment.status` already included `reversed` in v1.0.

## Rev 1.2 — Fake webhook stub (Wave G)

- `POST /api/v1/payments/webhooks/fake` — Fake-provider-only webhook stub (PAY-PROVIDER-001; no real MoMo vendor). Requires `finance.manage` (v1 simplicity — no signature-header scheme exists yet, since no sandbox contract has been chosen).
- Request body: `{ eventId: string, paymentAttemptId?: uuid, amountMinor: integer > 0, outcome: 'succeeded' | 'failed' }`.
- Dedupes on `(tenantId, providerCode='fake', eventId)` via `payment_gateway_events`' unique constraint (`ON CONFLICT DO NOTHING`, SECURITY DEFINER helper).
- Response: `{ data: { accepted: true, duplicate: boolean } }`. v1 deliberately does **not** chain into a payment-completion path — no gateway-initiated pending-payment flow exists yet, so the event is stored and acknowledged only.

## Solo-operator honesty

Provisional for IMP-009.
