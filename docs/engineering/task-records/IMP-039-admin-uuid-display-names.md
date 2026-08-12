# IMP-039 — Admin UUID → display names

| Field     | Value                                    |
| --------- | ---------------------------------------- |
| Program   | **IMP-039**                              |
| Date      | 2026-08-11                               |
| Status    | **Done** (solo-operator provisional)     |
| Depends   | IMP-038 · resolve-related-names helpers  |
| Authority | Solo-operator provisional (SOLO-GOV-001) |

## Outcome

Stop showing raw UUIDs on high-traffic Admin list/related columns by resolving missing FK ids via existing GET-by-id APIs. No new API surface.

## Delivered

| Surface                    | Fix                                                                                    |
| -------------------------- | -------------------------------------------------------------------------------------- |
| Memberships list           | `resolveUserNames` → displayName / email                                               |
| Invoices list Student      | Backfill missing `studentNames` via `resolveStudentNames` (no `slice(0,8)` happy path) |
| Enrollments list           | Backfill missing student + class names                                                 |
| Student detail enrollments | Resolve `streamId` via `resolveStreamNames`                                            |

Helpers added in `apps/web/src/lib/admin/resolve-related-names.ts`:
`resolveStudentNames`, `resolveUserNames`, `resolveStreamNames`, `missingNameIds`.

## Explicitly not done

- ~~Terms / classes / streams / structures year–class picker-gap columns (later wave)~~ → **IMP-040**
- ~~Muted detail `Id:` footers, org parent paste~~ → **IMP-040** (notifications `shortId` still intentional)
- New list join fields / OpenAPI
- PAY-OPS
