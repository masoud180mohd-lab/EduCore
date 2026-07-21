# API Contract Freeze — Attendance (ACF-009)

| Field     | Value                     |
| --------- | ------------------------- |
| Freeze ID | `ACF-009`                 |
| Version   | `1.3`                     |
| Date      | 2026-07-21                |
| Authority | Solo-operator provisional |

## History

1.0 sessions list · 1.1 get · 1.2 create/close · **1.3 records get/put**

## Permissions

| Code              | Roles               |
| ----------------- | ------------------- |
| attendance.read   | owner, admin, staff |
| attendance.manage | owner, admin, staff |

## Endpoints

| Method | Path                                       | AuthZ             | Notes                                                                      |
| ------ | ------------------------------------------ | ----------------- | -------------------------------------------------------------------------- |
| GET    | `/api/v1/attendance-sessions`              | attendance.read   | filters: classId, sessionDate, status, limit, cursor                       |
| GET    | `/api/v1/attendance-sessions/{id}`         | attendance.read   | 404 Session not found.                                                     |
| POST   | `/api/v1/attendance-sessions`              | attendance.manage | Idempotency required; body classId, streamId?, sessionDate, notes?         |
| POST   | `/api/v1/attendance-sessions/{id}/close`   | attendance.manage | Idempotency recommended                                                    |
| GET    | `/api/v1/attendance-sessions/{id}/records` | attendance.read   |                                                                            |
| PUT    | `/api/v1/attendance-sessions/{id}/records` | attendance.manage | Idempotency required; body `{ "records": [{ studentId, status, note? }] }` |

## Rules

- Derive academicYearId/termId from class on create.
- Record upsert requires active enrollment for session class.
- Closed session rejects record PUT (409).
- Allowlist: ids only for relations (no nested student objects).

## Related

- OpenAPI: `docs/engineering/api-contract-freeze/openapi/acf-008-009-enrollments-attendance.openapi.yaml`
- DBF-009; IMP-005; AUDIT-R5 High backlog (OpenAPI expansion)
- **IMP-006** consumes this contract for teacher UI (no API change).
