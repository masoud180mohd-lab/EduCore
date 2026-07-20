# IMP-003-C0 — `GET /api/v1/classes` (Classes List)

## Outcome

Open first **Classes** product READ under Academic Structure: cursor list for session-bound tenant with `academic.read`, optional `academicYearId` / `termId` filters.

## Status

**Complete** (2026-07-21). Freezes DBF-005 / ACF-005 v1.0 solo-operator provisional.

## Freezes

| Artifact | Path                                                                 |
| -------- | -------------------------------------------------------------------- |
| DBF-005  | `docs/engineering/database-freeze/DBF-005-classes-list-slice.md`     |
| ACF-005  | `docs/engineering/api-contract-freeze/ACF-005-classes-list-slice.md` |

## Locked

- Flat `GET /api/v1/classes`
- `academic_year_id` required column; `term_id` optional
- Order `name ASC, id ASC`
- Permission reuse `academic.read`
- SELECT-only for `educore_app`

## Implementation

Migration `20260720230000_classes_list_read`; `ClassesRepository` / `ClassesService` / `ClassesController`.

## Non-goals

Detail, create, streams, subjects, enrollments.

## Related

Terms list IMP-003-P3 pattern twin.
