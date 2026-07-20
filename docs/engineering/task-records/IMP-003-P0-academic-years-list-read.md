# IMP-003-P0 — First Academic Structure Read: `GET /api/v1/academic-years`

## Naming choice

**Task ID:** `IMP-003-P0` (Academic Structure series; not IMP-001 identity or IMP-002 students).

## Outcome

Open the first Academic Structure product **READ**: list academic years for the session-bound tenant with `academic.read`, cursor pagination (`starts_on DESC NULLS LAST, id ASC`), and `status` / `search` filters.

## Status

**Complete** (2026-07-20). Freezes accepted solo-operator provisional.

## Freezes

| Artifact | Path                                                                        |
| -------- | --------------------------------------------------------------------------- |
| DBF-003  | `docs/engineering/database-freeze/DBF-003-academic-years-list-slice.md`     |
| ACF-003  | `docs/engineering/api-contract-freeze/ACF-003-academic-years-list-slice.md` |

## Locked decisions

1. Keyset order: `starts_on DESC NULLS LAST, id ASC`
2. `startsOn` / `endsOn` optional null
3. Status enum: `draft` \| `active` \| `closed`

## Endpoint

| Method | Path                     | AuthZ                                               |
| ------ | ------------------------ | --------------------------------------------------- |
| `GET`  | `/api/v1/academic-years` | `RequirePermission('academic.read')` + session bind |

### Query

`limit`, `cursor`, `status`, `search` (no term/class filters).

### Response

`AcademicYearListEnvelope`: allowlisted fields only  
(`id`, `tenantId`, `name`, `code`, `startsOn`, `endsOn`, `status`, `createdAt`, `updatedAt`).

## Implementation

| Layer      | Path                                                          |
| ---------- | ------------------------------------------------------------- |
| Migration  | `20260720180000_academic_years_list_read`                     |
| Controller | `academic-structure/controllers/academic-years.controller.ts` |
| Service    | `application/academic-years.service.ts`                       |
| Repository | `repositories/academic-years.repository.ts`                   |
| Permission | `academic.read` in catalogue + system roles owner/admin/staff |

## Explicit non-goals

- Academic year writes, GET by id
- terms, classes, streams, subjects, enrollments
- Student grade filters

## Residual risks

- Solo-operator freeze lacks independent peer review
- Empty list until platform seed / future create writes
- Live RLS isolation re-verify after migrate

## Verification

```bash
npm run check
```

## Related

- Pattern twin: [IMP-002-P0-students-list-read.md](./IMP-002-P0-students-list-read.md)
