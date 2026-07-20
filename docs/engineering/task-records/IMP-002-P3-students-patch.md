# IMP-002-P3 — `PATCH /api/v1/students/{id}` (Student Partial Update)

## Outcome

Open student **PATCH** under DBF-002 rev 1.2 / ACF-002 rev 1.3: update allowlisted fields for a student in the session-bound tenant with `student.manage`. Missing / cross-tenant / invalid id → **404** `Student not found.`

## Status

**Complete** (2026-07-21). Solo-operator provisional freezes.

## Endpoint

| Method  | Path                    | AuthZ                                                | Idempotency |
| ------- | ----------------------- | ---------------------------------------------------- | ----------- |
| `PATCH` | `/api/v1/students/{id}` | `RequirePermission('student.manage')` + session bind | Optional    |

**operationId:** `patchStudent`  
Body allowlist: `displayName?`, `studentCode?` (null clears), `status?` — at least one required.  
Response **200** `StudentEnvelope`.

## Implementation

| Layer      | Path                                                    |
| ---------- | ------------------------------------------------------- |
| Migration  | `20260720220000_students_update` — `app.update_student` |
| Repository | `updateForTenant`                                       |
| Service    | `patchForTenant` + `parseUpdateStudentRequest`          |
| Controller | `@Patch(':id')`                                         |

## Security

- Table UPDATE remains REVOKED for `educore_app`
- Helper: membership + `tenant_id` bind; empty result → 404
- Staff cannot patch (no `student.manage`)
- Audit: `student.patch` with field names only

## Non-goals

DELETE, guardians, enrollments.

## Related

- Create: [IMP-002-P2-students-create.md](./IMP-002-P2-students-create.md)
- Twin: users PATCH IMP-001-P17
