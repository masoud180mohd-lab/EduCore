# DSF-004 — Admin Fees / Bursar UI (provisional)

| Field     | Value                                                   |
| --------- | ------------------------------------------------------- |
| Freeze ID | `DSF-004`                                               |
| Version   | `1.2`                                                   |
| Date      | 2026-07-27                                              |
| Audience  | School admin / bursar (desktop-first, usable on tablet) |
| Authority | Solo-operator provisional (SOLO-GOV-001)                |
| Program   | **IMP-010** / **IMP-024** / **IMP-028**                 |
| Contract  | ACF-012 rev 1.4 / DBF-012                               |

**Honesty:** Provisional design-system slice for IMP-010 only. Does **not** accept kit-wide Design System Freeze. Reuses DSF-001 tokens and DSF-002 admin chrome; adds bursar fee workflows against existing Nest finance HTTP.

## Goal

Prove finance end-to-end **before MoMo**: fee structures → draft/issue invoices → office payment → receipts, plus void/reverse where the API allows. Operator is a school bursar on AdminShell.

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

## Screens in scope

1. **Fees hub** — short links: Structures, Invoices, Receipts
2. **Fee structures list** — `GET /fee-structures` + create form (`POST`, Idempotency-Key)
3. **Fee structure detail** — `GET /fee-structures/{id}` with items; **edit** name / status / items via `PATCH` (Idempotency-Key). Item payload is full replace and only sent when the item list changed; **409** when items are referenced by invoices.
4. **Invoices list** — `GET /invoices` + create draft form; **AdminTable** (student, status chip, totalMinor, balanceMinor, Open) + Load more
5. **Invoice detail** — lines, balance; **Issue** (draft); **Void** (issued, unpaid); **Record office payment**; payments list; **Reverse** on succeeded payment; **Reconcile** (Wave X — `finance.reconcile`) outcome display only
6. **Receipts list** — `GET /receipts`; **AdminTable** (receiptNumber, status chip, issuedAt, Open) + Load more
7. **Receipt detail** — `GET /receipts/{id}` + optional **Reconcile** on linked payment

## Status vocabulary (chips)

| Domain    | Values                                                   |
| --------- | -------------------------------------------------------- |
| Invoice   | `draft` · `issued` · `partially_paid` · `paid` · `void`  |
| Payment   | `succeeded` · `reversed` (+ others read-only if present) |
| Receipt   | `issued` · `reversed`                                    |
| Structure | `draft` · `active` · `archived`                          |

## Component inventory (this slice)

- `AdminShell` nav: **Fees** (between Guardians and Settings)
- Shared banners / buttons / fields from DSF-001–002
- Resource list pattern (loading / empty / error / forbidden) + **IMP-028 AdminTable** for Invoices/Receipts registries
- Money format helper (`formatTzsMinor`) — table money cells read-only from API minor units
- Structure create form (name, year, status, line items)
- Structure detail edit form (name, status, replaceable items; year/currency read-only)
- Invoice create form (student picker, year, structure → prefill lines, or manual lines)
- Office payment form (method: cash | bank | cheque | other; amount ≤ balance)
- Confirm dialogs for void / reverse (destructive) — **IMP-034 `ConfirmDialog`** (not `window.confirm`)

## AuthZ UX

| HTTP                    | UX                                                                |
| ----------------------- | ----------------------------------------------------------------- |
| 401                     | “Sign in again.”                                                  |
| 403                     | “You do not have access for this school.” / action                |
| 404                     | “Not found.”                                                      |
| 409                     | Surface API message (e.g. already issued, void blocked when paid) |
| Missing Idempotency-Key | Existing client copy                                              |

Permissions used (seeded; not UI-gated beyond API failures):

- `finance.read` — lists/details
- `finance.manage` — create, issue, void, pay, reverse
- `finance.reconcile` — Wave X reconcile button (owner/admin); 403 → “You do not have finance reconcile access.”

Fake webhook remains **out of MVP UI**.

## Nav & routes

| Route                                               | Purpose                       |
| --------------------------------------------------- | ----------------------------- |
| `/t/[tenantId]/admin/fees`                          | Hub                           |
| `/t/[tenantId]/admin/fees/structures`               | List + create                 |
| `/t/[tenantId]/admin/fees/structures/[structureId]` | Detail + edit                 |
| `/t/[tenantId]/admin/fees/invoices`                 | List + create draft           |
| `/t/[tenantId]/admin/fees/invoices/[invoiceId]`     | Detail + pay / void / reverse |
| `/t/[tenantId]/admin/fees/receipts`                 | List                          |
| `/t/[tenantId]/admin/fees/receipts/[receiptId]`     | Detail                        |

## Auth storage

Same as DSF-001/002: Bearer + `X-Tenant-Id` in `sessionStorage`. Mutations use `readOrCreateIdempotencyKey` / `clearIdempotencyKey`.

## Non-goals

- Real MoMo / production provider (PAY-PROVIDER-001)
- Parent portal pay UI — **parent/guardian fees visibility → DSF-005 (IMP-011)**
- Gateway initiate → pending → complete / Fake webhook operator console
- Multi-currency beyond TZS; writable balance fields
- Claiming reconcile mutates ledger or payment status (outcome is compare-only)
- Full offline finance sync
- Nest API feature creep

## Solo-operator honesty

Accepted under acting seats only; revise when a second review seat exists.

## Revisions

| Ver | Date       | Notes                                                               |
| --- | ---------- | ------------------------------------------------------------------- |
| 1.0 | 2026-07-22 | IMP-010 provisional bursar fees UI                                  |
| 1.1 | 2026-07-26 | IMP-024 fee structure detail edit (`PATCH`, items replace + 409 UX) |
| 1.2 | 2026-07-27 | IMP-028 AdminTable for Invoices + Receipts lists                    |
| 1.3 | 2026-07-27 | IMP-034 ConfirmDialog for void / reverse (not window.confirm)       |
