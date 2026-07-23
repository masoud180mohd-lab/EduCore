# DSF-006 — Parent portal shell + fees (read-only)

| Field     | Value                                     |
| --------- | ----------------------------------------- |
| Freeze ID | `DSF-006`                                 |
| Version   | `1.0`                                     |
| Date      | 2026-07-23                                |
| Audience  | Bound guardian (parent) desktop-first     |
| Authority | Solo-operator provisional (SOLO-GOV-001)  |
| Program   | **IMP-011-PX**                            |
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

On guardian detail: bind/unbind userId when `guardian.manage` (staff). Honest empty if user has no membership.

## Non-goals

- MoMo / pay buttons that POST
- Teacher/admin chrome inside parent shell
- Fake portal without bind

## Solo-operator honesty

Acting seats only.
