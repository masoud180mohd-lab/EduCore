# IMP-010 — Admin Fees UI (bursar workflow)

| Field     | Value                             |
| --------- | --------------------------------- |
| Program   | **IMP-010**                       |
| Date      | 2026-07-22                        |
| Freezes   | DSF-004; consumes ACF-012/DBF-012 |
| Authority | Solo-operator provisional         |

## Discovery (U0a)

| Dependency                        | Status                           |
| --------------------------------- | -------------------------------- |
| IMP-009 Finance HTTP + ACF-012    | Green on main                    |
| finance.read / manage / reconcile | Seeded; UI uses read/manage only |
| Students + academic years lists   | Green (IMP-002 / IMP-003)        |
| AdminShell + guardians twin       | Green (IMP-007 / DSF-002)        |
| Fees routes under admin           | **Delivered this program**       |

## Waves

| Wave | Work                                            | Status  |
| ---- | ----------------------------------------------- | ------- |
| U0b  | DSF-004 provisional                             | Done    |
| U0c  | Fees nav + hub                                  | Done    |
| U1   | Structures list/create/detail                   | Done    |
| U2   | Invoices list/create/detail + issue/void        | Done    |
| U3   | Office pay + payments list + receipts + reverse | Done    |
| U4   | Money/action unit tests + tooling + manual QA   | Done    |
| X1   | Reconcile operator UI (`finance.reconcile`)     | Done    |
| X2   | Fake webhook UI                                 | Skipped |

## Routes (web)

- `/t/[tenantId]/admin/fees`
- `/t/[tenantId]/admin/fees/structures`
- `/t/[tenantId]/admin/fees/structures/[structureId]`
- `/t/[tenantId]/admin/fees/invoices`
- `/t/[tenantId]/admin/fees/invoices/[invoiceId]`
- `/t/[tenantId]/admin/fees/receipts`
- `/t/[tenantId]/admin/fees/receipts/[receiptId]`

## Money UX

- Display: `formatTzsMinor` — major units, 2 decimals, scale 100.
- Input: `parseMajorToMinor` — major → minor before POST.
- Balance always from API `balanceMinor` (never client ledger).

## API consumed (ACF-012)

| Method   | Path                      | Mutation key            |
| -------- | ------------------------- | ----------------------- |
| GET/POST | `/fee-structures`         | create: Idempotency-Key |
| GET      | `/fee-structures/{id}`    |                         |
| GET/POST | `/invoices`               | create: Idempotency-Key |
| GET      | `/invoices/{id}`          |                         |
| POST     | `/invoices/{id}/issue`    | Idempotency-Key         |
| POST     | `/invoices/{id}/void`     | Idempotency-Key         |
| POST     | `/payments`               | Idempotency-Key         |
| GET      | `/invoices/{id}/payments` |                         |
| GET      | `/payments/{id}`          |                         |
| POST     | `/payments/{id}/reverse`  | Idempotency-Key         |
| GET      | `/receipts` (+ by id)     |                         |

## Doubt checks

| Question                  | Answer                                                |
| ------------------------- | ----------------------------------------------------- |
| Overpay from UI?          | Client blocks amount > balance; API still enforces    |
| Pay draft?                | Pay form only when issued/partial + balance > 0       |
| Double-click Pay?         | Same Idempotency-Key via sessionStorage action key    |
| Fees nav without finance? | Nav visible; lists/actions fail with finance 403 copy |

## Five-axis review

| Axis        | Verdict | Notes                                                     |
| ----------- | ------- | --------------------------------------------------------- |
| Correctness | Pass    | ACF-012 allowlists; derived balance; issue/void/pay rules |
| Security    | Pass    | Bearer + tenant; no secrets; AuthZ server-side            |
| A11y / UX   | Pass    | Labels; banners; confirm void/reverse; MoMo note          |
| Tests       | Pass    | money + action helpers; tooling routes; `npm run check`   |
| Docs        | Pass    | DSF-004 + this record; DSF-002 non-goal amended           |

## Residual

- No Playwright e2e
- Wave X2 Fake webhook UI not built
- MoMo still blocked (PAY-PROVIDER-001)
- Existing tenants need finance grants if not reconciled

## Next

Parent fees view **or** real MoMo adapter (after PAY-PROVIDER supersede).
