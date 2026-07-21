# API Contract Freeze — Enrollments (ACF-008)

## Freeze status

| Field               | Value                                                   |
| ------------------- | ------------------------------------------------------- |
| Freeze ID           | `ACF-008`                                               |
| Title               | API Contract Freeze — enrollments list/get/create/patch |
| Version             | `1.3`                                                   |
| Date                | 2026-07-21                                              |
| Authority           | Solo-operator provisional (SOLO-GOV-001)                |
| Companion DB freeze | DBF-008                                                 |

**Honesty qualifier:** Solo-operator provisional.

## Revision history

| Version | Date       | Notes                            |
| ------- | ---------- | -------------------------------- |
| 1.0     | 2026-07-21 | List only (`listEnrollments`)    |
| 1.1     | 2026-07-21 | GET by id (`getEnrollment`)      |
| 1.2     | 2026-07-21 | POST create (`createEnrollment`) |
| **1.3** | 2026-07-21 | PATCH status (`patchEnrollment`) |

## Scope

| In scope                                           | Out of scope                                          |
| -------------------------------------------------- | ----------------------------------------------------- |
| GET list / GET detail / POST create / PATCH status | Attendance, nested student/class objects, bulk import |
| Permissions academic.read / academic.manage        | enrollment.* invention                                |

## Locked decisions

- Flat `/api/v1/enrollments`
- Create body: `studentId`, `classId`, `streamId?`, `status?` default **active** (no body academicYearId/termId/tenantId)
- Year/term from class row in helper
- Status enum: active \| withdrawn \| completed \| suspended
- List order: created_at ASC, id ASC

## Endpoint: list

| Method | Path                  | AuthZ                              |
| ------ | --------------------- | ---------------------------------- |
| GET    | `/api/v1/enrollments` | academic.read + session bind + RLS |

**operationId:** `listEnrollments`

Query: `limit`, `cursor`, `studentId?`, `classId?`, `academicYearId?`, `streamId?`, `status?`  
Non-UUID filter → 400; foreign UUID → empty page.

## Endpoint: get by id

| Method | Path                                 | AuthZ         |
| ------ | ------------------------------------ | ------------- |
| GET    | `/api/v1/enrollments/{enrollmentId}` | academic.read |

**operationId:** `getEnrollment` — Nest `:id`  
404 message: `Enrollment not found.`

## Endpoint: create

| Method | Path                  | AuthZ           | Idempotency  |
| ------ | --------------------- | --------------- | ------------ |
| POST   | `/api/v1/enrollments` | academic.manage | **Required** |

**operationId:** `createEnrollment`  
201 `EnrollmentEnvelope`. 409 on unique open enrollment.  
400 if student/class/stream not in tenant or stream/class mismatch.

## Endpoint: patch status

| Method | Path                                 | AuthZ           | Idempotency |
| ------ | ------------------------------------ | --------------- | ----------- |
| PATCH  | `/api/v1/enrollments/{enrollmentId}` | academic.manage | Optional    |

**operationId:** `patchEnrollment`  
Body allowlist: `{ "status": "active"|"withdrawn"|"completed"|"suspended" }` only.  
v1 allows any status transition. 404 if missing/cross-tenant.

## Allowlist item

id, tenantId, studentId, classId, streamId, academicYearId, termId, status, enrolledAt, createdAt, updatedAt.

## Audit

- `enrollment.create`
- `enrollment.patch` metadata `{ status }`

## Acceptance (solo-operator)

Signed 2026-07-21 (Backend / Security / Principal acting).

## Related

DBF-008; IMP-004-E0 … E4
