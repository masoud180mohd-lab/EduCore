# API Contract Freeze — Streams (ACF-006)

| Field     | Value                     |
| --------- | ------------------------- |
| Freeze ID | `ACF-006`                 |
| Version   | `1.2`                     |
| Date      | 2026-07-21                |
| Authority | Solo-operator provisional |

## History

1.0 list · 1.1 get · **1.2 create**

## Endpoints

| Method | Path                         | AuthZ           | Notes                                                |
| ------ | ---------------------------- | --------------- | ---------------------------------------------------- |
| GET    | `/api/v1/streams`            | academic.read   | operationId `listStreams`; classId?, status?, search |
| GET    | `/api/v1/streams/{streamId}` | academic.read   | operationId `getStream`; 404 `Stream not found.`     |
| POST   | `/api/v1/streams`            | academic.manage | operationId `createStream`; Idempotency-Key required |

### Create body

`classId` (required UUID), `name`, `code?`, `status?` default draft.  
Parent class missing/other-tenant → 400 `classId not found in this tenant.`

### Allowlist

id, tenantId, classId, name, code, status, createdAt, updatedAt.
