# API Contract Freeze — Subjects (ACF-007)

| Field     | Value                     |
| --------- | ------------------------- |
| Freeze ID | `ACF-007`                 |
| Version   | `1.2`                     |
| Date      | 2026-07-21                |
| Authority | Solo-operator provisional |

## History

1.0 list · 1.1 get · **1.2 create**

## Endpoints

| Method | Path                           | AuthZ           | Notes                                                 |
| ------ | ------------------------------ | --------------- | ----------------------------------------------------- |
| GET    | `/api/v1/subjects`             | academic.read   | operationId `listSubjects`; status?, search           |
| GET    | `/api/v1/subjects/{subjectId}` | academic.read   | operationId `getSubject`; 404 `Subject not found.`    |
| POST   | `/api/v1/subjects`             | academic.manage | operationId `createSubject`; Idempotency-Key required |

### Create body

`name` (required), `code?`, `status?` default draft.

### Allowlist

id, tenantId, name, code, status, createdAt, updatedAt.

## Related

- OpenAPI: `docs/engineering/api-contract-freeze/openapi/acf-002-007-students-academic.openapi.yaml` (ASSURE-001; solo-operator, no re-sign)
