# IMP-011-P0a — Discovery: guardian fees path

| Field    | Value                                 |
| -------- | ------------------------------------- |
| Program  | **IMP-011** Wave P0a                  |
| Date     | 2026-07-23                            |
| Decision | **Admin compose** (not parent portal) |

## Findings

| Question                    | Result                                                             |
| --------------------------- | ------------------------------------------------------------------ |
| Guardian ↔ user portal bind | **Missing** — DBF-010 defers portal login / `user_id` bind         |
| Parent shell `/parent/**`   | **Absent** in `apps/web`                                           |
| `GET /invoices?studentId=`  | **Present** — ACF-012 + Nest `InvoicesController` (`finance.read`) |
| ACF-010 links               | `GET /guardians/{id}/links`, `GET /students/{id}/guardians`        |
| finance.read actor          | Bursar/staff roles — not a parent portal permission                |
| MoMo / parent pay           | Still blocked — PAY-PROVIDER-001                                   |

## GO path

Ship **admin-assisted guardian fees** under:

`/t/[tenantId]/admin/guardians/[guardianId]/fees/**`

Skip Wave PX (true parent portal) until DBF/ACF unlock guardian user bind.

## Nest amend

**None** — client compose of ACF-010 + ACF-012 is sufficient for staff `finance.read`.
