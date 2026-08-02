# DSF-004 — Admin Fees / Bursar UI (provisional)

| Field     | Value                                                   |
| --------- | ------------------------------------------------------- |
| Freeze ID | `DSF-004`                                               |
| Version   | `1.5`                                                   |
| Date      | 2026-08-02                                              |
| Audience  | School admin / bursar (desktop-first, usable on tablet) |
| Authority | Solo-operator provisional (SOLO-GOV-001)                |
| Program   | **IMP-010** / **IMP-024** / **IMP-028** / **PAY-006**   |
| Contract  | ACF-012 rev 1.7 / DBF-012 / PAY-002                     |

**Honesty:** Provisional design-system slice for bursar fees + ClickPesa status UX. Does **not** accept kit-wide Design System Freeze. Reuses DSF-001 tokens and DSF-002 admin chrome.

## Goal

Bursar workflow: fee structures → invoices → office payment **and** mobile-money BillPay (when ClickPesa configured) → receipts; pending MoMo visibility + **Refresh from provider** (query sync). Fake remains truthful when provider is not configured.

## Tokens

Reuse DSF-001 CSS variables (`--color-*`, `--space-*`, `--font-sans`, `--radius`, `--focus-ring`). Admin shell max-width remains `56rem` (DSF-002).

Avoid purple-on-white AI defaults and marketing hero chrome.

## Money display (v1)

- API amounts are integer `amountMinor` only (ACF-012; floats rejected).
- Currency: **TZS** only; **scale 100** (100 minor = 1.00 TZS major).
- UI **displays** major units with fixed 2 decimals (e.g. `TZS 150,000.00` from `15000000`).
- Input fields collect major units; convert to `amountMinor` before POST (×100). Reject non-numeric and >2 fractional digits.
- Balance is **read-only** (`balanceMinor` derived from API); never invent a client ledger.

## Type & density

Same as DSF-002:

- Title: 1.25rem / 600
- Body: 1rem / 400
- Meta: 0.875rem / 400
- Primary actions ≥44px touch; denser list rows OK
- BillPay / control number: large mono, selectable (`user-select: all`) — never invent a number

## Screens in scope

1. **Fees hub** — short links: Structures, Invoices, Receipts; optional **Sync pending (tenant)** (PAY-006)
2. **Fee structures list** — `GET /fee-structures` + create form (`POST`, Idempotency-Key); **AdminTable** (name, year, status chip, currency, Open) + Load more
3. **Fee structure detail** — `GET /fee-structures/{id}` with items; **edit** name / status / items via `PATCH` (Idempotency-Key). Item payload is full replace and only sent when the item list changed; **409** when items are referenced by invoices.
4. **Invoices list** — `GET /invoices` + create draft form; **AdminTable** (student, status chip, totalMinor, balanceMinor, Open) + Load more
5. **Invoice detail** — lines, balance; **Issue** (draft); **Void** (issued, unpaid); **Record office payment**; **Request mobile money** (when balance > 0); payments list with method + status chips; **BillPay** on pending MoMo; **Refresh from provider** (`sync-provider`); **Reverse** / **Reconcile** (compare-only ≠ Sync)
6. **Receipts list** — `GET /receipts`; **AdminTable** (receiptNumber, status chip, issuedAt, Open) + Load more
7. **Receipt detail** — `GET /receipts/{id}` + optional **Reconcile** on linked payment

## Status vocabulary (chips)

| Domain    | Values                                                               |
| --------- | -------------------------------------------------------------------- |
| Invoice   | `draft` · `issued` · `partially_paid` · `paid` · `void`              |
| Payment   | `pending` · `succeeded` · `failed` · `reversed` (+ others read-only) |
| Receipt   | `issued` · `reversed`                                                |
| Structure | `draft` · `active` · `archived`                                      |

## Sync vs Reconcile (locked)

| Control                   | API                                    | Effect                                                            |
| ------------------------- | -------------------------------------- | ----------------------------------------------------------------- |
| **Refresh from provider** | `POST /payments/{id}/sync-provider`    | Queries ClickPesa; may complete/fail pending MoMo via ingest      |
| **Reconcile**             | `POST /payments/{id}/reconcile`        | Compare attempt vs last gateway event only — **no ledger change** |
| **Sync pending (tenant)** | `POST /payments/sync-provider-pending` | Batch query sync for pending ClickPesa attempts                   |

## Fake / ClickPesa honesty

- Runtime default is **Fake** (CI / local without secrets).
- Initiate MoMo or Sync returning `NOT_IMPLEMENTED` / 501 → clear banner: provider not configured; do **not** fake success.
- BillPay number comes only from API (`providerRef` on GET, or `billPayNumber` on create).

## Component inventory (this slice)

- `AdminShell` nav: **Fees** (between Guardians and Settings)
- Shared banners / buttons / fields from DSF-001–002
- Resource list pattern (loading / empty / error / forbidden) + **IMP-028 AdminTable** for Structures/Invoices/Receipts registries
- Money format helper (`formatTzsMinor`) — table money cells read-only from API minor units
- Structure create form (name, year, status, line items)
- Structure detail edit form (name, status, replaceable items; year/currency read-only)
- Invoice create form (student picker, year, structure → prefill lines, or manual lines)
- Office payment form (method: cash | bank | cheque | other; amount ≤ balance)
- Mobile-money request form (amount ≤ balance; shows returned BillPay)
- Pending MoMo row: BillPay mono + Refresh from provider
- Confirm dialogs for void / reverse only — **not** required for Sync (non-destructive query)

## AuthZ UX

| HTTP                    | UX                                                            |
| ----------------------- | ------------------------------------------------------------- |
| 401                     | “Sign in again.”                                              |
| 403                     | “You do not have access for this school.” / action            |
| 403 (reconcile/sync)    | “You do not have finance reconcile access.”                   |
| 404                     | “Not found.”                                                  |
| 409                     | Surface API message                                           |
| 501 / NOT_IMPLEMENTED   | Honest “Mobile money provider not configured (Fake default)…” |
| Missing Idempotency-Key | Existing client copy                                          |

Permissions (UX gate optional; API is truth):

- `finance.read` — lists/details
- `finance.manage` — create, issue, void, pay, reverse, initiate MoMo
- `finance.reconcile` — Reconcile + Refresh from provider + Sync pending

Fake webhook remains **out of MVP UI**. Parent pay remains **out** (DSF-005/006).

## Nav & routes

| Route                                               | Purpose                                     |
| --------------------------------------------------- | ------------------------------------------- |
| `/t/[tenantId]/admin/fees`                          | Hub (+ optional Sync pending)               |
| `/t/[tenantId]/admin/fees/structures`               | List + create                               |
| `/t/[tenantId]/admin/fees/structures/[structureId]` | Detail + edit                               |
| `/t/[tenantId]/admin/fees/invoices`                 | List + create draft                         |
| `/t/[tenantId]/admin/fees/invoices/[invoiceId]`     | Detail + pay / MoMo / void / reverse / sync |
| `/t/[tenantId]/admin/fees/receipts`                 | List                                        |
| `/t/[tenantId]/admin/fees/receipts/[receiptId]`     | Detail                                      |

## Auth storage

Same as DSF-001/002: Bearer + `X-Tenant-Id` in `sessionStorage`. Mutations use `readOrCreateIdempotencyKey` / `clearIdempotencyKey`.

## Non-goals

- Parent portal pay / checkout UI
- Selcom / USSD Push / cards
- Fake webhook operator console
- Background cron daemon UI (sync is on-demand HTTP)
- Multi-currency beyond TZS; writable balance fields
- Claiming Reconcile mutates ledger (compare-only)
- Inventing BillPay numbers or completing payments client-side
- Nest API redesign; committing ClickPesa secrets

## Solo-operator honesty

Accepted under acting seats only; revise when a second review seat exists.

## Revisions

| Ver | Date       | Notes                                                               |
| --- | ---------- | ------------------------------------------------------------------- |
| 1.0 | 2026-07-22 | IMP-010 provisional bursar fees UI                                  |
| 1.1 | 2026-07-26 | IMP-024 fee structure detail edit (`PATCH`, items replace + 409 UX) |
| 1.2 | 2026-07-27 | IMP-028 AdminTable for Invoices + Receipts lists                    |
| 1.3 | 2026-07-27 | IMP-034 ConfirmDialog for void / reverse (not window.confirm)       |
| 1.4 | 2026-07-31 | IMP-028 residual: Fee structures list → AdminTable                  |
| 1.5 | 2026-08-02 | PAY-006: pending MoMo + BillPay + Sync vs Reconcile; Fake honesty   |
