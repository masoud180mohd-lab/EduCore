# IMP-002-P0 — First Student Registry Read: `GET /api/v1/students`

## Naming choice

**Task ID:** `IMP-002-P0` (new program series for Student Registry; not IMP-001 identity increments).

## Outcome

Open the first Student Registry product **READ**: list students for the session-bound tenant with `student.read`, cursor pagination, and `status` / `search` filters.

## Status

**Complete** (2026-07-20). Freezes accepted solo-operator provisional.

## Freezes

| Artifact | Path                                                                          |
| -------- | ----------------------------------------------------------------------------- |
| DBF-002  | `docs/engineering/database-freeze/DBF-002-student-registry-list-slice.md`     |
| ACF-002  | `docs/engineering/api-contract-freeze/ACF-002-student-registry-list-slice.md` |

## Endpoint

| Method | Path               | AuthZ                                              |
| ------ | ------------------ | -------------------------------------------------- |
| `GET`  | `/api/v1/students` | `RequirePermission('student.read')` + session bind |

### Query

`limit`, `cursor`, `status`, `search` (no grade/class).

### Response

`StudentListEnvelope`: allowlisted fields only (`id`, `tenantId`, `studentCode`, `displayName`, `status`, `createdAt`, `updatedAt`).

## Implementation

| Layer      | Path                                                         |
| ---------- | ------------------------------------------------------------ |
| Migration  | `20260720160000_students_list_read`                          |
| Controller | `student-registry/controllers/students.controller.ts`        |
| Service    | `application/students.service.ts`                            |
| Repository | `repositories/students.repository.ts`                        |
| Permission | `student.read` in catalogue + system roles owner/admin/staff |

## Explicit non-goals

- Student writes, GET by id, guardians, enrollments, grade filters

## Residual risks

- Solo-operator freeze lacks independent peer review
- Empty list until platform seed inserts students
- Live RLS isolation re-verify after migrate

## Follow-up

- Detail: [IMP-002-P1-students-get-by-id.md](./IMP-002-P1-students-get-by-id.md) (ACF-002 rev 1.1)

## Verification

```bash
npm run check
```
