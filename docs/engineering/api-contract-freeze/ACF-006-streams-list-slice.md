# API Contract Freeze — Streams (ACF-006)

| Field     | Value                     |
| --------- | ------------------------- |
| Freeze ID | `ACF-006`                 |
| Version   | `1.3`                     |
| Date      | 2026-07-24                |
| Authority | Solo-operator provisional |

## History

1.0 list · 1.1 get · 1.2 create · **1.3 patch (IMP-013)**

## Endpoints

| Method | Path                         | AuthZ           | Notes                                                |
| ------ | ---------------------------- | --------------- | ---------------------------------------------------- |
| GET    | `/api/v1/streams`            | academic.read   | operationId `listStreams`; classId?, status?, search |
| GET    | `/api/v1/streams/{streamId}` | academic.read   | operationId `getStream`; 404 `Stream not found.`     |
| POST   | `/api/v1/streams`            | academic.manage | operationId `createStream`; Idempotency-Key required |
| PATCH  | `/api/v1/streams/{streamId}` | academic.manage | operationId `patchStream`; Idempotency-Key optional  |

### Create body

`classId` (required UUID), `name`, `code?`, `status?` default draft.  
Parent class missing/other-tenant → 400 `classId not found in this tenant.`

### Patch body (rev 1.3)

Allowlist (≥1): `name`, `code` (null/empty clears), `status` (`draft`\|`active`\|`closed`).  
No `classId` reparenting. 404 missing/cross-tenant; 409 duplicate code.

### Allowlist

id, tenantId, classId, name, code, status, createdAt, updatedAt.

## Related

- OpenAPI: `docs/engineering/api-contract-freeze/openapi/acf-002-007-students-academic.openapi.yaml` (ASSURE-001; solo-operator, no re-sign)
