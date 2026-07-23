# API Contract Freeze — Parent portal bind + scoped fees (ACF-013)

| Field     | Value                                             |
| --------- | ------------------------------------------------- |
| Freeze ID | `ACF-013`                                         |
| Version   | `1.0`                                             |
| Date      | 2026-07-23                                        |
| Companion | DBF-011                                           |
| Amends    | ACF-010 (portal auth was out of scope — unlocked) |
| Authority | Solo-operator provisional (SOLO-GOV-001)          |
| Program   | **IMP-011-PX**                                    |

**Honesty:** Provisional. Prefer dedicated `/me/*` routes over widening `finance.read`.

## Auth stack

Bearer + `X-Tenant-Id` → session↔tenant bind → active membership → permission → RLS.

## Staff bind (guardian.manage)

| Method | Path                                 | Notes                                       |
| ------ | ------------------------------------ | ------------------------------------------- |
| POST   | `/api/v1/guardians/{id}/bind-user`   | Body `{ userId }`; Idempotency-Key required |
| POST   | `/api/v1/guardians/{id}/unbind-user` | Clears bind; Idempotency-Key required       |

Responses: `{ data: Guardian }` where Guardian includes `userId: string \| null`.

Errors: 400 validation; 404 guardian/user; 409 user already bound; 403 missing manage.

## Parent self (parent.guardian.read)

| Method | Path                        | Notes                                                          |
| ------ | --------------------------- | -------------------------------------------------------------- |
| GET    | `/api/v1/me/guardian`       | Guardian bound to caller; 404 if unbound                       |
| GET    | `/api/v1/me/guardian/links` | Active+ended links; include `studentDisplayName` when joinable |

## Parent fees (parent.finance.read) — read-only

| Method | Path                                     | Notes                                             |
| ------ | ---------------------------------------- | ------------------------------------------------- |
| GET    | `/api/v1/me/fees/invoices`               | **Requires** `studentId`; must be actively linked |
| GET    | `/api/v1/me/fees/invoices/{id}`          | Invoice student must be allowlisted               |
| GET    | `/api/v1/me/fees/invoices/{id}/payments` | Same isolation                                    |
| GET    | `/api/v1/me/fees/receipts/{id}`          | Resolve via payment→invoice→student allowlist     |

Shapes reuse ACF-012 invoice/payment/receipt envelopes (read fields only).

**Forbidden:** any payment POST, issue/void, reconcile, Fake webhook from parent surface.

## Isolation rule

Server allowlist = active `student_guardians` for the caller’s bound guardian.  
Never return tenant-wide invoice lists to `parent.finance.read`.

## Non-goals

- Parent pay / MoMo (PAY-PROVIDER-001)
- Granting parents `finance.read` or `guardian.read` (staff directory)
- Nest redesign of bursar finance controllers

## Solo-operator honesty

Acting seats only.
