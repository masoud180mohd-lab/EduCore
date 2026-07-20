# IMP-003-P1 — `GET /api/v1/academic-years/{id}` (Academic Year Detail)

## Outcome

Open academic year **detail** under DBF-003 / ACF-003 rev 1.1: return one year in the session-bound tenant with `academic.read`. Missing / cross-tenant / invalid id → **404** (no existence leak).

## Status

**Complete** (2026-07-20).

## Endpoint

| Method | Path                          | AuthZ                                               |
| ------ | ----------------------------- | --------------------------------------------------- |
| `GET`  | `/api/v1/academic-years/{id}` | `RequirePermission('academic.read')` + session bind |

Response: same allowlist as list item (`AcademicYearEnvelope`).

## Implementation

| Layer      | Path                                     |
| ---------- | ---------------------------------------- |
| Repository | `getByIdForTenant`                       |
| Service    | `getForTenant`                           |
| Controller | `@Get(':id')` after list (before writes) |

## Non-goals

Field expansion, nested terms/classes, writes.

## Related

- List: [IMP-003-P0-academic-years-list-read.md](./IMP-003-P0-academic-years-list-read.md)
- Twin: [IMP-002-P1-students-get-by-id.md](./IMP-002-P1-students-get-by-id.md)
