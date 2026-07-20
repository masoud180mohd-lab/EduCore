# IMP-003-P2 — `POST /api/v1/academic-years` (Create Academic Year)

## Outcome

Gated product **write**: create an academic year in the session-bound tenant with `academic.manage`, required Idempotency-Key, and audit event.

## Status

**Complete** (2026-07-20).

## Freezes

| Artifact            | Notes                                                                    |
| ------------------- | ------------------------------------------------------------------------ |
| DBF-003 rev **1.1** | `app.create_academic_year`; table INSERT stays revoked for `educore_app` |
| ACF-003 rev **1.2** | `createAcademicYear` / body allowlist / 201 envelope                     |

## Endpoint

| Method | Path                     | AuthZ                            | Idempotency  |
| ------ | ------------------------ | -------------------------------- | ------------ |
| `POST` | `/api/v1/academic-years` | `academic.manage` + session bind | **Required** |

### Body

- `name` required (1–200)
- `code` optional (unique per tenant)
- `startsOn` / `endsOn` optional ISO dates
- `status` optional (default **`draft`**)

## Permission

| Code              | Roles                        |
| ----------------- | ---------------------------- |
| `academic.manage` | owner, admin (**not** staff) |

## Implementation

| Layer      | Path                                                           |
| ---------- | -------------------------------------------------------------- |
| Migration  | `20260720190000_academic_years_create`                         |
| Controller | `@Post()` `@HttpCode(201)` before `@Get(':id')`                |
| Service    | `createForTenant` + idempotency + audit `academic_year.create` |
| Repository | `createForTenant` → helper                                     |

## Residual risks

- In-memory idempotency multi-instance
- Noop audit persistence
- Migrate required for helper + permission seed

## Related

- P0 list / P1 detail
- Twin: [IMP-002-P2-students-create.md](./IMP-002-P2-students-create.md)
