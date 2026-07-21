# API Contract Freeze — Guardians slice (ACF-010)

| Field     | Value                                    |
| --------- | ---------------------------------------- |
| Freeze ID | `ACF-010`                                |
| Version   | `1.0`                                    |
| Date      | 2026-07-21                               |
| Companion | DBF-010                                  |
| Authority | Solo-operator provisional (SOLO-GOV-001) |

**Honesty:** Provisional; IMP-007 consumes this contract.

## Scope

| In scope                                                         | Out of scope                |
| ---------------------------------------------------------------- | --------------------------- |
| `GET/POST /api/v1/guardians`                                     | Parent portal auth          |
| `GET/PATCH /api/v1/guardians/{guardianId}`                       | Nested student PII on list  |
| `GET /api/v1/guardians/{guardianId}/links`                       | DELETE guardian hard-delete |
| `POST /api/v1/guardians/{guardianId}/links`                      | IAM relationships           |
| `POST /api/v1/guardians/{guardianId}/links/{linkId}/end`         |                             |
| `GET /api/v1/students/{studentId}/guardians` (links for student) |                             |
| Permissions `guardian.read` / `guardian.manage`                  |                             |

All routes: Bearer + `X-Tenant-Id` required. Links are ids-only (`studentId`, `guardianId`); UI resolves names via students/guardians GET.

## Guardian resource allowlist

`id`, `tenantId`, `displayName`, `phone`, `email`, `status`, `createdAt`, `updatedAt`

## Link resource allowlist

`id`, `tenantId`, `studentId`, `guardianId`, `relationshipType`, `isPrimary`, `status`, `createdAt`, `updatedAt`

## Endpoints (summary)

| Method | Path                                 | AuthZ           | Notes                                                          |
| ------ | ------------------------------------ | --------------- | -------------------------------------------------------------- |
| GET    | `/guardians`                         | guardian.read   | limit, cursor, status, search                                  |
| POST   | `/guardians`                         | guardian.manage | Idempotency-Key required                                       |
| GET    | `/guardians/{id}`                    | guardian.read   | 404 cross-tenant                                               |
| PATCH  | `/guardians/{id}`                    | guardian.manage | displaylist patch                                              |
| GET    | `/guardians/{id}/links`              | guardian.read   | active+ended optional filter                                   |
| POST   | `/guardians/{id}/links`              | guardian.manage | body: studentId, relationshipType, isPrimary?; Idempotency-Key |
| POST   | `/guardians/{id}/links/{linkId}/end` | guardian.manage | sets status=ended                                              |
| GET    | `/students/{id}/guardians`           | guardian.read   | list links for student                                         |

## Errors

- 400 validation / non-enrolled? N/A — student must exist in tenant
- 404 unknown guardian/student/link (no existence leak across tenants)
- 409 duplicate active link
- 401/403 standard

## Solo-operator honesty

Provisional acceptance for IMP-007.
