# API Contract Freeze — Classes List + Detail + Create (ACF-005)

## Freeze status

| Field               | Value                                                              |
| ------------------- | ------------------------------------------------------------------ |
| Freeze ID           | `ACF-005`                                                          |
| Title               | API Contract Freeze — classes list + get + create + patch + delete |
| Version             | `1.4` (1.3 patch; 1.4 delete + reparent IMP-014)                   |
| Date                | 2026-07-25                                                         |
| Authority           | Solo-operator provisional acceptance (SOLO-GOV-001)                |
| Companion DB freeze | DBF-005 (+ create helper)                                          |

**Honesty qualifier:** Solo-operator provisional.

## Revision history

| Version | Date       | Notes                                                                          |
| ------- | ---------- | ------------------------------------------------------------------------------ |
| 1.0     | 2026-07-21 | List only (`listClasses`)                                                      |
| 1.1     | 2026-07-21 | `GET /classes/{id}` getClass                                                   |
| **1.2** | 2026-07-21 | `POST /classes` createClass                                                    |
| **1.3** | 2026-07-24 | `PATCH /classes/{id}` (IMP-013)                                                |
| **1.4** | 2026-07-25 | `DELETE /classes/{id}` + `academicYearId`/`termId` reparent on PATCH (IMP-014) |

## Scope

| In scope                                              | Out of scope          |
| ----------------------------------------------------- | --------------------- |
| GET list, GET detail, POST create, PATCH, DELETE      | Cascade delete        |
| Reparent `academicYearId`/`termId` on PATCH (rev 1.4) | streams / enrollments |
| academic.read / academic.manage                       | class.* invention     |

## Endpoint: list

| Method | Path              | AuthZ                              |
| ------ | ----------------- | ---------------------------------- |
| GET    | `/api/v1/classes` | academic.read + session bind + RLS |

**operationId:** `listClasses`

Query: `limit`, `cursor`, `academicYearId?`, `termId?`, `status?`, `search?`  
Order: `name ASC, id ASC`  
Foreign/missing year/term UUID filters → empty page; non-UUID → 400.

## Endpoint: get by id (rev 1.1)

| Method | Path                        | AuthZ                              |
| ------ | --------------------------- | ---------------------------------- |
| GET    | `/api/v1/classes/{classId}` | academic.read + session bind + RLS |

**operationId:** `getClass` — Nest `:id`  
Miss/cross-tenant/invalid → 404 `Class not found.`

## Endpoint: create (rev 1.2)

| Method | Path              | AuthZ                          | Idempotency  |
| ------ | ----------------- | ------------------------------ | ------------ |
| POST   | `/api/v1/classes` | academic.manage + session bind | **Required** |

**operationId:** `createClass`

Body: `academicYearId` (required UUID), `termId?`, `name` (1–200), `code?`, `status?` default **draft**.  
Parent year missing/other-tenant → 400 `academicYearId not found in this tenant.`  
Parent term missing/wrong year/tenant → 400 on `termId`.  
Duplicate code → 409.  
Audit: `class.create`.

## Endpoint: patch (rev 1.3–1.4 / IMP-013, IMP-014)

| Method | Path                        | AuthZ           | Idempotency  |
| ------ | --------------------------- | --------------- | ------------ |
| PATCH  | `/api/v1/classes/{classId}` | academic.manage | **Optional** |

**operationId:** `patchClass`

Allowlist (≥1): `name`, `code` (null/empty clears), `status`, `academicYearId` (UUID, required when set — reparent to another year in the bound tenant, rev 1.4), `termId` (UUID or `null` — `null` clears the term link; reparent to a term in the bound tenant when set, rev 1.4).  
404 missing/cross-tenant; 409 duplicate code; `academicYearId`/`termId` present but missing/other-tenant target → 400 `VALIDATION_ERROR`. Audit: `class.patch`.

## Endpoint: delete (rev 1.4 / IMP-014)

| Method | Path                        | AuthZ           | Idempotency |
| ------ | --------------------------- | --------------- | ----------- |
| DELETE | `/api/v1/classes/{classId}` | academic.manage | n/a         |

**operationId:** `deleteClass`  
Success **204** empty body. Missing/cross-tenant → **404**. Any dependent (e.g. streams, enrollments referencing this class) → **409** `CONFLICT`. No cascade.

## Acceptance (solo-operator)

Signed 2026-07-21 (Backend / Security / Principal acting). Delete + reparent (rev 1.4) accepted under the same solo-operator acting seats, 2026-07-25.

## Related

- OpenAPI: `docs/engineering/api-contract-freeze/openapi/acf-002-007-students-academic.openapi.yaml` (ASSURE-001; solo-operator, no re-sign)
- DBF-005; IMP-003-C0/C1/C2
