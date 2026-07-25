# API Contract Freeze — Enrollments (ACF-008)

## Freeze status

| Field               | Value                                                              |
| ------------------- | ------------------------------------------------------------------ |
| Freeze ID           | `ACF-008`                                                          |
| Title               | API Contract Freeze — enrollments list/get/create/patch (transfer) |
| Version             | `1.4`                                                              |
| Date                | 2026-07-25                                                         |
| Authority           | Solo-operator provisional (SOLO-GOV-001)                           |
| Companion DB freeze | DBF-008                                                            |

**Honesty qualifier:** Solo-operator provisional.

## Revision history

| Version | Date       | Notes                                                      |
| ------- | ---------- | ---------------------------------------------------------- |
| 1.0     | 2026-07-21 | List only (`listEnrollments`)                              |
| 1.1     | 2026-07-21 | GET by id (`getEnrollment`)                                |
| 1.2     | 2026-07-21 | POST create (`createEnrollment`)                           |
| 1.3     | 2026-07-21 | PATCH status (`patchEnrollment`)                           |
| **1.4** | 2026-07-25 | PATCH placement transfer: `classId` / `streamId` (IMP-018) |

## Scope

| In scope                                                       | Out of scope                                          |
| -------------------------------------------------------------- | ----------------------------------------------------- |
| GET list / GET detail / POST create / PATCH status + placement | Attendance, nested student/class objects, bulk import |
| Permissions academic.read / academic.manage                    | enrollment.\* invention, bulk transfer                |

## Locked decisions

- Flat `/api/v1/enrollments`
- Create body: `studentId`, `classId`, `streamId?`, `status?` default **active** (no body academicYearId/termId/tenantId)
- Year/term from class row in helper (create and transfer)
- Status enum: active \| withdrawn \| completed \| suspended
- List order: created_at ASC, id ASC
- **Transfer is in-place** (same enrollment id); not withdraw+create

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

## Endpoint: patch (status and/or placement)

| Method | Path                                 | AuthZ           | Idempotency |
| ------ | ------------------------------------ | --------------- | ----------- |
| PATCH  | `/api/v1/enrollments/{enrollmentId}` | academic.manage | Optional    |

**operationId:** `patchEnrollment`

Body allowlist (at least one field required):

| Field      | Rules                                                            |
| ---------- | ---------------------------------------------------------------- |
| `status`   | `active` \| `withdrawn` \| `completed` \| `suspended`            |
| `classId`  | UUID; re-derives `academicYearId` / `termId` from target class   |
| `streamId` | UUID or **null** (clears stream). Must belong to effective class |

When `classId` is set and `streamId` is omitted, stream is **cleared** (old stream may not belong to new class).  
v1 allows any status transition. 404 if missing/cross-tenant.  
409 if unique open conflict (student+class+year for active/suspended).  
400 if class/stream not in tenant or stream/class mismatch.

## Allowlist item

id, tenantId, studentId, classId, streamId, academicYearId, termId, status, enrolledAt, createdAt, updatedAt.

## Audit

- `enrollment.create`
- `enrollment.patch` metadata `{ fields: [...] }` (may include `status`, `classId`, `streamId`)

## Acceptance (solo-operator)

Signed 2026-07-21 (Backend / Security / Principal acting). Rev 1.4 provisional under SOLO-GOV-001.

## Related

- OpenAPI: `docs/engineering/api-contract-freeze/openapi/acf-008-009-enrollments-attendance.openapi.yaml`
- DBF-008; IMP-004-E0 … E4; **IMP-018**
- AUDIT-R5 High backlog (OpenAPI expansion)
