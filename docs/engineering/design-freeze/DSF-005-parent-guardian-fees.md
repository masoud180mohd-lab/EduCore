# DSF-005 — Parent / Guardian Fees View (read-only, provisional)

| Field     | Value                                                       |
| --------- | ----------------------------------------------------------- |
| Freeze ID | `DSF-005`                                                   |
| Version   | `1.0`                                                       |
| Date      | 2026-07-23                                                  |
| Audience  | Admin/bursar assisting a guardian; future portal twin       |
| Authority | Solo-operator provisional (SOLO-GOV-001)                    |
| Program   | **IMP-011**                                                 |
| Contract  | ACF-010 (links) + ACF-012 (invoices/payments/receipts read) |

**Honesty:** Provisional design-system slice for IMP-011 only. Does **not** accept kit-wide Design System Freeze. Reuses DSF-001 tokens, DSF-002 AdminShell, DSF-004 money display.

## Discovery outcome (P0a)

| Question                      | Finding                                      | Path chosen        |
| ----------------------------- | -------------------------------------------- | ------------------ |
| Guardian ↔ user portal bind?  | **Missing** (DBF-010: portal login deferred) | Admin compose only |
| `GET /invoices?studentId=`?   | Yes (ACF-012 / Nest)                         | Compose on client  |
| Who can finance.read?         | Bursar roles (owner/admin/staff with grants) | Staff-assisted UX  |
| Parent shell under `/parent`? | **Absent**                                   | Skip Wave PX       |

## Goal

Close the loop after IMP-010 bursar path: show **linked students’ invoices, balances, payments, and receipts** — **read-only** — with honest “pay at the office / mobile money not enabled” copy.

## Tokens & density

Reuse DSF-001 / DSF-002 / DSF-004. Admin shell max-width `56rem`. Status chips same vocabulary as DSF-004 invoice/payment statuses.

## Money display

- Reuse `formatTzsMinor` (TZS scale 100).
- **No** payment amount inputs; **no** `parseMajorToMinor` on this surface.
- Balance always from API `balanceMinor`.

## Screens in scope

1. **Guardian fees entry** — `/admin/guardians/[guardianId]/fees`  
   Active linked students only; link into per-student invoices.
2. **Per-student invoices** — `.../fees/students/[studentId]`  
   `GET /invoices?studentId=` filtered to allowlisted linked student.
3. **Read-only invoice detail** — `.../fees/invoices/[invoiceId]`  
   Lines, totals, balance; payments list; receipt links. **No** Issue / Void / Pay / Reverse / Reconcile.
4. Optional: open existing bursar invoice URL only as a separate staff path (not required).

## Isolation rule (mandatory)

Guardian fees context ⊆ **active** `GET /guardians/{id}/links` `studentId`s only.  
Never list all-tenant invoices. Reject / redirect if `studentId` or invoice’s student is not in the allowlist.

## AuthZ UX

| HTTP           | UX                                           |
| -------------- | -------------------------------------------- |
| 401            | Sign in again                                |
| 403            | “You do not have finance / guardian access.” |
| 404            | Not found                                    |
| Empty links    | “Link a student to this guardian first.”     |
| Empty invoices | “No invoices for this student yet.”          |

Permissions (staff session): `guardians` read/manage as today + `finance.read` for invoice/payment/receipt GETs. This surface must **never** expose finance.manage / reconcile actions.

## Persistent copy

> Pay at the school office. Mobile money is not enabled (PAY-PROVIDER-001).

## Non-goals

- Real MoMo / production provider (PAY-PROVIDER-001)
- Parent pay / checkout / gateway initiate→complete
- Fake webhook console; reconcile UX expansion
- True parent portal shell / guardian user bind (Wave PX)
- Nest finance redesign; parent-scoped finance.read (ACF-013) unless future unlock
- Writable balances; multi-currency beyond TZS

## Solo-operator honesty

Accepted under acting seats only; revise when a second review seat exists.
