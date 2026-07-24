# API Contract Freeze — Streams (ACF-006)

| Field     | Value                                            |
| --------- | ------------------------------------------------ |
| Freeze ID | `ACF-006`                                        |
| Version   | `1.4` (1.3 patch; 1.4 delete + reparent IMP-014) |
| Date      | 2026-07-25                                       |
| Authority | Solo-operator provisional                        |

## History

1.0 list · 1.1 get · 1.2 create · 1.3 patch (IMP-013) · **1.4 delete + reparent (IMP-014)**

## Endpoints

| Method | Path                         | AuthZ           | Notes                                                |
| ------ | ---------------------------- | --------------- | ---------------------------------------------------- |
| GET    | `/api/v1/streams`            | academic.read   | operationId `listStreams`; classId?, status?, search |
| GET    | `/api/v1/streams/{streamId}` | academic.read   | operationId `getStream`; 404 `Stream not found.`     |
| POST   | `/api/v1/streams`            | academic.manage | operationId `createStream`; Idempotency-Key required |
| PATCH  | `/api/v1/streams/{streamId}` | academic.manage | operationId `patchStream`; Idempotency-Key optional  |
| DELETE | `/api/v1/streams/{streamId}` | academic.manage | operationId `deleteStream`; n/a Idempotency          |

### Create body

`classId` (required UUID), `name`, `code?`, `status?` default draft.  
Parent class missing/other-tenant → 400 `classId not found in this tenant.`

### Patch body (rev 1.3–1.4)

Allowlist (≥1): `name`, `code` (null/empty clears), `status` (`draft`\|`active`\|`closed`), `classId` (UUID, required when set — reparent to another class in the bound tenant, rev 1.4).  
404 missing/cross-tenant; 409 duplicate code; `classId` present but missing/other-tenant target class → 400 `VALIDATION_ERROR`.

### Delete (rev 1.4 / IMP-014)

Success **204** empty body. Missing/cross-tenant → **404**. Any dependent (e.g. enrollments referencing this stream) → **409** `CONFLICT`. No cascade.

### Allowlist

id, tenantId, classId, name, code, status, createdAt, updatedAt.

## Related

- OpenAPI: `docs/engineering/api-contract-freeze/openapi/acf-002-007-students-academic.openapi.yaml` (ASSURE-001; solo-operator, no re-sign)
