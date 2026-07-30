# IMP-031x — Create prefill `?studentId=` (Wave X)

| Field     | Value                            |
| --------- | -------------------------------- |
| Program   | **IMP-031** Wave X               |
| Date      | 2026-07-31                       |
| Depends   | IMP-031 cross-links; admin-paths |
| Authority | Solo-operator provisional        |

## Goal

Student detail “Create enrollment” / “Create invoice” open the create form with the student already selected.

## Behavior

- `adminEnrollmentsCreatePath(tenantId, studentId?)` / `adminInvoicesCreatePath(tenantId, studentId?)` append `?studentId=`
- Create pages read `useSearchParams`, seed select once, and `GET /students/{id}` to merge the option if not on the first picker page

## Verify

```bash
npx vitest run apps/web/src/lib/admin/admin-paths.test.ts tests/tooling/imp031-admin-crosslinks.test.ts
```
