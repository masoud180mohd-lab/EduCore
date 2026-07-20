# API Contract Freeze — Terms List + Detail + Create (ACF-004)

## Freeze status

| Field               | Value                                               |
| ------------------- | --------------------------------------------------- |
| Freeze ID           | `ACF-004`                                           |
| Title               | API Contract Freeze — terms list + get + create     |
| Version             | `1.2`                                               |
| Date                | 2026-07-21                                          |
| Authority           | Solo-operator provisional acceptance (SOLO-GOV-001) |
| Companion DB freeze | DBF-004 (+ write helper rev 1.1)                    |

**Honesty qualifier:** Accepted under solo-operator acting seats — **not** multi-party external review.

## Revision history

| Version | Date       | Notes                                 |
| ------- | ---------- | ------------------------------------- |
| 1.0     | 2026-07-20 | List only (`listTerms`)               |
| 1.1     | 2026-07-21 | Add `GET /terms/{termId}` (`getTerm`) |
| **1.2** | 2026-07-21 | Add `POST /terms` (`createTerm`)      |

## Scope

| In scope                                        | Out of scope                                         |
| ----------------------------------------------- | ---------------------------------------------------- |
| `GET /api/v1/terms` list                        | PATCH/DELETE terms                                   |
| `GET /api/v1/terms/{termId}` detail             | Nested `/academic-years/{id}/terms` path (v1 closed) |
| `POST /api/v1/terms` create (rev 1.2)           | classes, streams, subjects, enrollments              |
| Cursor pagination + filters                     | Nested academicYear expansion                        |
| Permissions `academic.read` / `academic.manage` | `term.read` / `term.manage` invention                |

Identity/Tenant ACF-001, Student ACF-002, Academic Years ACF-003 remain unchanged.

## Locked product decisions (D1–D10 + create)

| #   | Decision                                                       |
| --- | -------------------------------------------------------------- |
| D1  | Flat paths under `/api/v1/terms`                               |
| D2  | Optional list filter `academicYearId`; create body requires it |
| D3  | List/detail: `academic.read`; create: **`academic.manage`**    |
| D4  | Status enum: `draft` \| `active` \| `closed`                   |
| D5  | Dates optional; both set ⇒ `endsOn >= startsOn`                |
| D6  | List order: `starts_on ASC NULLS LAST, id ASC`                 |
| D7  | Cursor keyset on last row `id`                                 |
| D8  | Parent year FK + denormalized `tenant_id`                      |
| D9  | PATCH/DELETE closed; POST open (rev 1.2)                       |
| D10 | `educore_app` table INSERT remains REVOKED (helper only)       |

## Endpoint: list

| Method | Path            | Auth   | Header                     | AuthZ                                                                                |
| ------ | --------------- | ------ | -------------------------- | ------------------------------------------------------------------------------------ |
| `GET`  | `/api/v1/terms` | Bearer | `X-Tenant-Id` **required** | `RequirePermission('academic.read')` + session↔header bind + active membership + RLS |

**operationId:** `listTerms`

### Query

| Param            | Behavior                                                                      |
| ---------------- | ----------------------------------------------------------------------------- |
| `limit`          | 1–100, default **25** (`parsePaginationQuery`)                                |
| `cursor`         | Opaque last-page term `id` (keyset on `(starts_on ASC NULLS LAST, id ASC)`)   |
| `academicYearId` | Optional UUID; when present, only terms for that year **in the bound tenant** |
| `status`         | Optional: `draft` \| `active` \| `closed`                                     |
| `search`         | Optional: ILIKE on `name` / `code` (metachar escape)                          |

### Cross-tenant / missing year (list)

| Input                                            | Response                   |
| ------------------------------------------------ | -------------------------- |
| `academicYearId` not a UUID                      | **400** `VALIDATION_ERROR` |
| Valid UUID for year missing or other-tenant year | **200 empty page**         |

### Success 200 — `TermListEnvelope`

Allowlist fields: `id`, `tenantId`, `academicYearId`, `name`, `code`, `startsOn`, `endsOn`, `status`, `createdAt`, `updatedAt`.

### Errors (list)

| Condition                          | HTTP | Code                      |
| ---------------------------------- | ---- | ------------------------- |
| Missing/invalid bearer             | 401  | `UNAUTHORIZED`            |
| Missing `X-Tenant-Id`              | 400  | `TENANT_CONTEXT_REQUIRED` |
| Session ≠ header tenant            | 403  | `FORBIDDEN`               |
| No `academic.read`                 | 403  | `FORBIDDEN`               |
| Invalid limit / status / year UUID | 400  | `VALIDATION_ERROR`        |
| Pool/DB fail-closed                | 200  | empty page                |

---

## Endpoint: get by id (rev 1.1)

| Method | Path                     | Auth   | Header                     | AuthZ                                                                                |
| ------ | ------------------------ | ------ | -------------------------- | ------------------------------------------------------------------------------------ |
| `GET`  | `/api/v1/terms/{termId}` | Bearer | `X-Tenant-Id` **required** | `RequirePermission('academic.read')` + session↔header bind + active membership + RLS |

**operationId:** `getTerm`  
**Nest param:** `:id`

### Success 200 — `TermEnvelope`

Same allowlist as list item. Message on miss: `Term not found.`

| Condition                                           | HTTP | Code                      |
| --------------------------------------------------- | ---- | ------------------------- |
| Missing/invalid bearer                              | 401  | `UNAUTHORIZED`            |
| Missing `X-Tenant-Id`                               | 400  | `TENANT_CONTEXT_REQUIRED` |
| Session ≠ header / no `academic.read`               | 403  | `FORBIDDEN`               |
| Invalid UUID / missing / other tenant / fail-closed | 404  | `NOT_FOUND`               |

---

## Endpoint: create (rev 1.2)

| Method | Path            | Auth   | Header                     | AuthZ                                                                                  | Idempotency  |
| ------ | --------------- | ------ | -------------------------- | -------------------------------------------------------------------------------------- | ------------ |
| `POST` | `/api/v1/terms` | Bearer | `X-Tenant-Id` **required** | `RequirePermission('academic.manage')` + session↔header bind + active membership + RLS | **Required** |

**operationId:** `createTerm`  
**Nest route order:** `@Post()` after list `@Get()`, **before** `@Get(':id')`.

### Body — `CreateTermRequest`

| Field            | Rules                                                     |
| ---------------- | --------------------------------------------------------- |
| `academicYearId` | **required**; UUID; parent year **in bound tenant**       |
| `name`           | required; string; length 1–200                            |
| `code`           | optional; unique per (tenant, academic year) when set     |
| `startsOn`       | optional; ISO date `YYYY-MM-DD`                           |
| `endsOn`         | optional; ISO date; if both set, `endsOn >= startsOn`     |
| `status`         | optional; default **`draft`**; enum draft\|active\|closed |

`tenantId` **never** from body. Unknown keys → `VALIDATION_ERROR`.

### Parent year resolution (security)

| Condition                                    | HTTP | Code               |
| -------------------------------------------- | ---- | ------------------ |
| `academicYearId` missing / not UUID          | 400  | `VALIDATION_ERROR` |
| Parent year missing **or** other-tenant year | 400  | `VALIDATION_ERROR` |

Message (create): `academicYearId not found in this tenant.`  
Field detail: `academicYearId`.  
Does **not** use 403 that would distinguish foreign years.

### Success 201 — `TermEnvelope`

Same allowlist as GET. Created via `app.create_term` (SECURITY DEFINER).

### Errors (create)

| Condition                               | HTTP | Code family                |
| --------------------------------------- | ---- | -------------------------- |
| Missing/invalid bearer                  | 401  | `UNAUTHORIZED`             |
| Missing `X-Tenant-Id`                   | 400  | `TENANT_CONTEXT_REQUIRED`  |
| Session mismatch / no `academic.manage` | 403  | `FORBIDDEN`                |
| Missing Idempotency-Key                 | 400  | `IDEMPOTENCY_KEY_REQUIRED` |
| Body validation / parent year           | 400  | `VALIDATION_ERROR`         |
| Duplicate code in year                  | 409  | `CONFLICT`                 |
| Store unavailable / unexpected DB       | 500  | `INTERNAL_ERROR`           |

### Audit

On success: `term.create` with metadata `{ status, hasCode, academicYearId }` (no excess PII).

## Explicit non-goals

- PATCH/DELETE terms
- Nested year path
- Nested academicYear expansion
- classes / streams / subjects
- New permission codes (`term.*`)
- Table INSERT grant to `educore_app`

## Acceptance (solo-operator)

| Role                         | Status | Date       |
| ---------------------------- | ------ | ---------- |
| Backend Lead (acting)        | Signed | 2026-07-21 |
| Security (acting)            | Signed | 2026-07-21 |
| Principal Architect (acting) | Signed | 2026-07-21 |

## Related

- Companion: [DBF-004-terms-list-slice.md](../database-freeze/DBF-004-terms-list-slice.md)
- Parent list twin: [ACF-003-academic-years-list-slice.md](./ACF-003-academic-years-list-slice.md)
- Implementation: IMP-003-P3 list; P4 detail; P5 create
