# API Contract Freeze — Academic Years List Slice (ACF-003)

## Freeze status

| Field               | Value                                                                     |
| ------------------- | ------------------------------------------------------------------------- |
| Freeze ID           | `ACF-003`                                                                 |
| Title               | API Contract Freeze — academic-years list + get + create + patch + delete |
| Version             | `1.4` (1.3 patch; 1.4 delete IMP-014)                                     |
| Date                | 2026-07-25                                                                |
| Authority           | Solo-operator provisional acceptance (SOLO-GOV-001)                       |
| Companion DB freeze | DBF-003 (+ write helper rev for create)                                   |

**Honesty qualifier:** Accepted under solo-operator acting seats — **not** multi-party external review.

## Revision history

| Version | Date       | Notes                                              |
| ------- | ---------- | -------------------------------------------------- |
| 1.0     | 2026-07-20 | List only (`listAcademicYears`)                    |
| **1.1** | 2026-07-20 | Add `GET /academic-years/{id}` (`getAcademicYear`) |
| **1.2** | 2026-07-20 | Add `POST /academic-years` (`createAcademicYear`)  |
| **1.3** | 2026-07-24 | Add `PATCH /academic-years/{id}` (IMP-013)         |
| **1.4** | 2026-07-25 | Add `DELETE /academic-years/{id}` (IMP-014)        |

## Scope

| In scope                                             | Out of scope                                   |
| ---------------------------------------------------- | ---------------------------------------------- |
| `GET /api/v1/academic-years` list                    | Cascade delete                                 |
| `GET /api/v1/academic-years/{academicYearId}` detail | terms, classes, streams, subjects, enrollments |
| `POST /api/v1/academic-years` create (rev 1.2)       | Nested expansions                              |
| `PATCH /api/v1/academic-years/{id}` (rev 1.3)        |                                                |
| `DELETE /api/v1/academic-years/{id}` (rev 1.4)       |                                                |
| Cursor pagination + status/search on list            |                                                |
| Permissions `academic.read` / `academic.manage`      |                                                |

Identity/Tenant ACF-001 and Student ACF-002 remain unchanged.

## Endpoint: list

| Method | Path                     | Auth   | Header                     | AuthZ                                                                                |
| ------ | ------------------------ | ------ | -------------------------- | ------------------------------------------------------------------------------------ |
| `GET`  | `/api/v1/academic-years` | Bearer | `X-Tenant-Id` **required** | `RequirePermission('academic.read')` + session↔header bind + active membership + RLS |

**operationId:** `listAcademicYears`

### Query

| Param    | Behavior                                                                              |
| -------- | ------------------------------------------------------------------------------------- |
| `limit`  | 1–100, default **25** (`parsePaginationQuery`)                                        |
| `cursor` | Opaque last-page academic year `id` (keyset on `(starts_on DESC NULLS LAST, id ASC)`) |
| `status` | Optional: `draft` \| `active` \| `closed`                                             |
| `search` | Optional: ILIKE on `name` / `code` (metachar escape)                                  |

**Deferred:** term/class filters, “current year only” convenience (clients may filter `status=active`).

### Success 200 — `AcademicYearListEnvelope`

```json
{
  "data": [
    {
      "id": "uuid",
      "tenantId": "uuid",
      "name": "2026/2027",
      "code": "2026-27",
      "startsOn": "2026-01-15",
      "endsOn": "2026-12-15",
      "status": "active",
      "createdAt": "…",
      "updatedAt": "…"
    }
  ],
  "page": { "nextCursor": null, "limit": 25 }
}
```

| Field      | Notes                           |
| ---------- | ------------------------------- |
| `startsOn` | ISO date `YYYY-MM-DD` or `null` |
| `endsOn`   | ISO date `YYYY-MM-DD` or `null` |
| `code`     | string or `null`                |

**Allowlist only** — no nested terms/classes.

### Errors

| Condition               | HTTP | Code                                      |
| ----------------------- | ---- | ----------------------------------------- |
| Missing/invalid bearer  | 401  | `UNAUTHORIZED`                            |
| Missing `X-Tenant-Id`   | 400  | `TENANT_CONTEXT_REQUIRED`                 |
| Session ≠ header tenant | 403  | `FORBIDDEN` (+ session mismatch reason)   |
| No `academic.read`      | 403  | `FORBIDDEN`                               |
| Invalid limit/status    | 400  | `VALIDATION_ERROR`                        |
| Pool/DB fail-closed     | 200  | empty `{ data: [], page }` (list pattern) |

---

## Endpoint: get by id (rev 1.1)

| Method | Path                                      | Auth   | Header                     | AuthZ                                                                                |
| ------ | ----------------------------------------- | ------ | -------------------------- | ------------------------------------------------------------------------------------ |
| `GET`  | `/api/v1/academic-years/{academicYearId}` | Bearer | `X-Tenant-Id` **required** | `RequirePermission('academic.read')` + session↔header bind + active membership + RLS |

**operationId:** `getAcademicYear`  
**Nest param:** `:id`

### Success 200 — `AcademicYearEnvelope`

Same allowlist as list item (`id`, `tenantId`, `name`, `code`, `startsOn`, `endsOn`, `status`, `createdAt`, `updatedAt`).

### Visibility / errors (detail)

| Condition                                           | HTTP | Code                      |
| --------------------------------------------------- | ---- | ------------------------- |
| Missing/invalid bearer                              | 401  | `UNAUTHORIZED`            |
| Missing `X-Tenant-Id`                               | 400  | `TENANT_CONTEXT_REQUIRED` |
| Session ≠ header / no `academic.read`               | 403  | `FORBIDDEN`               |
| Invalid UUID / missing / other tenant / fail-closed | 404  | `NOT_FOUND` (generic msg) |

Message: `Academic year not found.`

---

## Endpoint: create (rev 1.2)

| Method | Path                     | Auth   | Header                     | AuthZ                                                                                  | Idempotency  |
| ------ | ------------------------ | ------ | -------------------------- | -------------------------------------------------------------------------------------- | ------------ |
| `POST` | `/api/v1/academic-years` | Bearer | `X-Tenant-Id` **required** | `RequirePermission('academic.manage')` + session↔header bind + active membership + RLS | **Required** |

**operationId:** `createAcademicYear`

### Body — `CreateAcademicYearRequest`

| Field      | Rules                                                     |
| ---------- | --------------------------------------------------------- |
| `name`     | required; string; length 1–200                            |
| `code`     | optional; unique per tenant when set                      |
| `startsOn` | optional; ISO date `YYYY-MM-DD`                           |
| `endsOn`   | optional; ISO date; if both set, `endsOn >= startsOn`     |
| `status`   | optional; default **`draft`**; enum draft\|active\|closed |

`tenantId` never from body. Unknown keys → `VALIDATION_ERROR`.

### Success 201 — `AcademicYearEnvelope`

Same allowlist as GET.

### Errors (create)

| Condition                               | HTTP | Code family                      |
| --------------------------------------- | ---- | -------------------------------- |
| Missing Idempotency-Key                 | 400  | `IDEMPOTENCY_KEY_REQUIRED`       |
| No `academic.manage` / session mismatch | 403  | `FORBIDDEN`                      |
| Invalid body                            | 400  | `VALIDATION_ERROR`               |
| Duplicate code                          | 409  | `CONFLICT`                       |
| Idempotency reuse different body        | 409  | `IDEMPOTENCY_KEY_REUSE_MISMATCH` |

Permission: `academic.manage` — owner + admin only (not staff).

---

## Endpoint: patch (rev 1.3 / IMP-013)

| Method  | Path                                      | Auth   | Header                     | AuthZ                                                                                  | Idempotency  |
| ------- | ----------------------------------------- | ------ | -------------------------- | -------------------------------------------------------------------------------------- | ------------ |
| `PATCH` | `/api/v1/academic-years/{academicYearId}` | Bearer | `X-Tenant-Id` **required** | `RequirePermission('academic.manage')` + session↔header bind + active membership + RLS | **Optional** |

**operationId:** `patchAcademicYear`

### Body — `PatchAcademicYearRequest` (partial; ≥1 field)

| Field      | Rules                                                                  |
| ---------- | ---------------------------------------------------------------------- |
| `name`     | optional; length 1–200 when set                                        |
| `code`     | optional; null/empty clears; unique per tenant when set                |
| `startsOn` | optional; ISO date or null to clear                                    |
| `endsOn`   | optional; ISO date or null; if both effective dates set, ends ≥ starts |
| `status`   | optional; `draft` \| `active` \| `closed` (any value; no matrix)       |

Unknown keys → `VALIDATION_ERROR`. Empty body → `VALIDATION_ERROR`.

### Success 200 — `AcademicYearEnvelope`

### Errors (patch)

| Condition                               | HTTP | Code family        |
| --------------------------------------- | ---- | ------------------ |
| No `academic.manage` / session mismatch | 403  | `FORBIDDEN`        |
| Invalid body / empty allowlist          | 400  | `VALIDATION_ERROR` |
| Missing / other tenant                  | 404  | `NOT_FOUND`        |
| Duplicate code                          | 409  | `CONFLICT`         |

---

## Endpoint: delete (rev 1.4 / IMP-014)

| Method   | Path                                      | AuthZ           | Idempotency |
| -------- | ----------------------------------------- | --------------- | ----------- |
| `DELETE` | `/api/v1/academic-years/{academicYearId}` | academic.manage | n/a         |

**operationId:** `deleteAcademicYear`  
Success **204** empty body. Missing/cross-tenant → **404**. Any dependent (terms, classes, enrollments, attendance, exams, fee_structures, invoices) → **409** `CONFLICT`. No cascade.

---

## Locked product decisions (IMP-003-P0+)

1. **Keyset order:** `starts_on DESC NULLS LAST, id ASC`
2. **Dates:** optional null; DB enforces `ends_on >= starts_on` when both set
3. **Status enum:** `draft` \| `active` \| `closed`
4. **Create default status:** `draft` (safer than active)
5. **PATCH (IMP-013):** allowlist only; years have no parent FK
6. **DELETE (IMP-014):** empty only; dependents → 409

## Acceptance (solo-operator)

| Role                           | Status | Date       |
| ------------------------------ | ------ | ---------- |
| API Contract Guardian (acting) | Signed | 2026-07-20 |
| Backend Lead (acting)          | Signed | 2026-07-20 |
| Security (acting)              | Signed | 2026-07-20 |

## Related

- OpenAPI: `docs/engineering/api-contract-freeze/openapi/acf-002-007-students-academic.openapi.yaml` (ASSURE-001; solo-operator, no re-sign)

- DBF-003: [DBF-003-academic-years-list-slice.md](../database-freeze/DBF-003-academic-years-list-slice.md)
- Clone pattern: IMP-002-P0 students list
