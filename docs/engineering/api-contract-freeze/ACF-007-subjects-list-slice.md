# API Contract Freeze — Subjects (ACF-007)

| Field     | Value                     |
| --------- | ------------------------- |
| Freeze ID | `ACF-007`                 |
| Version   | `1.3`                     |
| Date      | 2026-07-24                |
| Authority | Solo-operator provisional |

## History

1.0 list · 1.1 get · 1.2 create · **1.3 patch (IMP-013)**

## Endpoints

| Method | Path                           | AuthZ           | Notes                                                 |
| ------ | ------------------------------ | --------------- | ----------------------------------------------------- |
| GET    | `/api/v1/subjects`             | academic.read   | operationId `listSubjects`; status?, search           |
| GET    | `/api/v1/subjects/{subjectId}` | academic.read   | operationId `getSubject`; 404 `Subject not found.`    |
| POST   | `/api/v1/subjects`             | academic.manage | operationId `createSubject`; Idempotency-Key required |
| PATCH  | `/api/v1/subjects/{subjectId}` | academic.manage | operationId `patchSubject`; Idempotency-Key optional  |

### Create body

`name` (required), `code?`, `status?` default draft.

### Patch body (rev 1.3)

Allowlist (≥1): `name`, `code` (null/empty clears), `status` (`draft`\|`active`\|`closed`).  
404 missing/cross-tenant; 409 duplicate code.

### Allowlist

id, tenantId, name, code, status, createdAt, updatedAt.

## Related

- OpenAPI: `docs/engineering/api-contract-freeze/openapi/acf-002-007-students-academic.openapi.yaml` (ASSURE-001; solo-operator, no re-sign)
