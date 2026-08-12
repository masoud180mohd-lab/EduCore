# IMP-038 — Remaining Admin list filters (Guardians / Academic / Fee structures)

| Field     | Value                                      |
| --------- | ------------------------------------------ |
| Program   | **IMP-038**                                |
| Date      | 2026-08-11                                 |
| Status    | **Done** (solo-operator provisional)       |
| Depends   | IMP-036 list-filter pattern · ACF academic/fees |
| Authority | Solo-operator provisional (SOLO-GOV-001)   |

## Outcome

Wire Admin UI list filters the API already supported on Guardians, Academic years/subjects, and Fee structures. Same Apply / cursor pattern as IMP-036. No new API surface.

## Delivered

| List            | Filters                                      |
| --------------- | -------------------------------------------- |
| Guardians       | `search` + `status` (`active` / `inactive`)  |
| Academic years  | `search` + `status` (lifecycle)              |
| Subjects        | `search` + `status` (lifecycle)              |
| Fee structures  | `academicYearId` + `status` (`draft` / `active` / `archived`) |

- Apply resets cursor (`append: false`); Load more keeps **applied** filters.
- Years / subjects / structures: `AdminPageHeader` + `Banner` for list-page consistency.
- Admin hub blurbs mention filters (parity with Students / Users).

## Explicitly not done

- ~~Terms / classes / streams / enrollments remaining filters~~ → Terms/classes/streams in **IMP-040**; enrollments in **IMP-041**
- ~~UUID → name resolution (IMP-039 candidate)~~ → **IMP-039** / **IMP-040**
- Receipts (API has no list filters)
- New APIs / OpenAPI
- PAY-OPS / MFA
