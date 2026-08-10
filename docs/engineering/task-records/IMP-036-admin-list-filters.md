# IMP-036 — Admin list filters (Students / Users / Invoices)

| Field     | Value                                      |
| --------- | ------------------------------------------ |
| Program   | **IMP-036**                                |
| Date      | 2026-08-10                                 |
| Status    | **Done** (solo-operator provisional)       |
| Depends   | IMP-030 pagination · ACF-001/002/012       |
| Authority | Solo-operator provisional (SOLO-GOV-001)   |

## Outcome

Wire Admin UI list filters to query params the API already supported. No new API surface.

## Delivered

| List     | Filters                                                                 |
| -------- | ----------------------------------------------------------------------- |
| Students | `search` + `status` (was search-only)                                   |
| Users    | `search` + `status` (was search-only; use `invited` to find invites)    |
| Invoices | `status` + `studentId` + `academicYearId` (no text search — API has none) |

- Apply resets cursor (`append: false`); Load more keeps **applied** filters.
- Invoice `?studentId=` URL also applies as list filter (and still prefills create).

## Explicitly not done

- Inventing invoice text search
- Shared FilterBar component library
- PAY-OPS / ClickPesa
