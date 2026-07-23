# DSF-006 — Parent portal shell + fees (read-only)

| Field     | Value                                     |
| --------- | ----------------------------------------- |
| Freeze ID | `DSF-006`                                 |
| Version   | `1.1`                                     |
| Date      | 2026-07-23                                |
| Audience  | Bound guardian (parent) desktop-first     |
| Authority | Solo-operator provisional (SOLO-GOV-001)  |
| Program   | **IMP-011-PX** / **IMP-011-PX1**          |
| Contracts | ACF-013 + DBF-011; reuses DSF-005 screens |

**Honesty:** Provisional. Does not accept kit-wide Design System Freeze.

## Shell

- `ParentShell` under `/t/[tenantId]/parent/**`
- Nav: Home (fees), Sign out
- Tokens: reuse DSF-001 / Admin density (`56rem` max)

## Post-login routing

If `/auth/me` has role `parent` or `parent.guardian.read` (and not admin home) → `/t/{tenantId}/parent`.

## Screens

Twin of DSF-005 admin compose, under parent shell:

1. `/parent` — linked students (from `GET /me/guardian/links`)
2. `/parent/fees/students/[studentId]` — invoices via `GET /me/fees/invoices?studentId=`
3. `/parent/fees/invoices/[invoiceId]` — read-only detail + payments
4. `/parent/fees/receipts/[receiptId]` — read-only receipt

Persistent banner: pay at school office; mobile money not enabled (PAY-PROVIDER-001).

## Admin UX (bind)

On guardian detail (**Portal bind**):

- **Primary:** select a tenant user from `GET /api/v1/users` (label = displayName + email; value = user id). Requires `user.read`.
- **Bound state:** show resolved displayName/email when known; muted user id meta; Unbind with confirm.
- **Advanced (optional):** paste UUID only if user missing from list.
- Honest empty (no users), 403 (no user.read), 409 (already bound).
- Server still requires active membership on bind (ACF-013 / DBF-011).

## Non-goals

- MoMo / pay buttons that POST
- Teacher/admin chrome inside parent shell
- Fake portal without bind

## Solo-operator honesty

Acting seats only.
