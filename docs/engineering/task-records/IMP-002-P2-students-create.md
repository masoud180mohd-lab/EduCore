# IMP-002-P2 — `POST /api/v1/students` (Create Student)

## Outcome

Gated product **write**: create a student in the session-bound tenant with `student.manage`, required Idempotency-Key, and audit event.

## Status

**Complete** (2026-07-20).

## Freezes

| Artifact            | Notes                                                              |
| ------------------- | ------------------------------------------------------------------ |
| DBF-002 rev **1.1** | `app.create_student`; table INSERT stays revoked for `educore_app` |
| ACF-002 rev **1.2** | `createStudent` / `CreateStudentRequest` / 201 `StudentEnvelope`   |

## Endpoint

| Method | Path               | AuthZ                           | Idempotency  |
| ------ | ------------------ | ------------------------------- | ------------ |
| `POST` | `/api/v1/students` | `student.manage` + session bind | **Required** |

### Body

- `displayName` required (1–200)
- `studentCode` optional (unique per tenant)
- `status` optional (default `active`)

`tenantId` from bound header only.

## DB write path

SECURITY DEFINER `app.create_student` (`20260720170000_students_create`).

## Permission

| Code             | Roles                        |
| ---------------- | ---------------------------- |
| `student.manage` | owner, admin (**not** staff) |

## Implementation

| Layer      | Path                                                     |
| ---------- | -------------------------------------------------------- |
| Controller | `@Post()` `@HttpCode(201)` before `@Get(':id')`          |
| Service    | `createForTenant` + idempotency + audit `student.create` |
| Repository | `createForTenant` → helper                               |

## Non-goals

PATCH/DELETE, guardians, enrollments, academic joins.

## Residual risks

- In-memory idempotency multi-instance
- Noop audit persistence
- Migrate required: `npm run db:migrate`
- Solo-operator freeze honesty

## Verification

```bash
npm run check
```

## Related

- List/detail: P0 / P1
- Twins: P15 invite, P16 org create
