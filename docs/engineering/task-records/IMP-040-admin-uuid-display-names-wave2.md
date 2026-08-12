# IMP-040 — Admin UUID → display names (wave 2)

| Field     | Value                                    |
| --------- | ---------------------------------------- |
| Program   | **IMP-040**                              |
| Date      | 2026-08-11                               |
| Status    | **Done** (solo-operator provisional)     |
| Depends   | IMP-039 · resolve-related-names helpers  |
| Authority | Solo-operator provisional (SOLO-GOV-001) |

## Outcome

Close IMP-039 residuals: year/class labels beyond the first picker page on Terms/Classes/Streams/Fee structures; enrollment year name; org parent name hints; muted detail `Id:` UUID footers. Also Apply search+status parity on Terms/Classes/Streams. No new APIs.

## Delivered

| Surface | Fix |
| ------- | --- |
| Terms / Classes lists | `resolveYearNames` backfill; `search` + `status` Apply/cursor |
| Streams list | `resolveClassNames` backfill; `search` + `status` Apply/cursor |
| Fee structures list | `missingNameIds` + `resolveYearNames` on each list load (incl. Load more) |
| Enrollment detail | Year **name** via `resolveYearNames`; removed `Year id` / `Id:` UUID lines |
| Organizations create/detail | `resolveOrganizationNames` + live “Parent: {name}” when UUID paste resolves |
| Admin detail footers | Muted `Id: {uuid}` lines removed (id remains in URL) |

Helpers added in `apps/web/src/lib/admin/resolve-related-names.ts`:
`resolveYearNames`, `resolveOrganizationNames`, `looksLikeUuid` (+ unit tests).

## Explicitly not done

- Notifications `shortId` (intentional truncate)
- New list join fields / OpenAPI
- ~~Full org-tree parent picker redesign~~ → **IMP-042**
- PAY-OPS / Beem / Board re-review

## Verify

- Web typecheck + `resolve-related-names` vitest
- Manual: fee structure / term row for a year past first picker page shows year name
