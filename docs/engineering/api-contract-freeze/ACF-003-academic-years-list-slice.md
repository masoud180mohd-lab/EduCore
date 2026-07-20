# API Contract Freeze — Academic Years List Slice (ACF-003)

## Freeze status

| Field               | Value                                                          |
| ------------------- | -------------------------------------------------------------- |
| Freeze ID           | `ACF-003`                                                      |
| Title               | API Contract Freeze — academic-years list + get-by-id + create |
| Version             | `1.2` (1.0 list; 1.1 get; 1.2 create)                          |
| Date                | 2026-07-20                                                     |
| Authority           | Solo-operator provisional acceptance (SOLO-GOV-001)            |
| Companion DB freeze | DBF-003 (+ write helper rev for create)                        |

**Honesty qualifier:** Accepted under solo-operator acting seats — **not** multi-party external review.

## Revision history

| Version | Date       | Notes                                              |
| ------- | ---------- | -------------------------------------------------- |
| 1.0     | 2026-07-20 | List only (`listAcademicYears`)                    |
| **1.1** | 2026-07-20 | Add `GET /academic-years/{id}` (`getAcademicYear`) |
| **1.2** | 2026-07-20 | Add `POST /academic-years` (`createAcademicYear`)  |

## Scope

| In scope                                             | Out of scope                                   |
| ---------------------------------------------------- | ---------------------------------------------- |
| `GET /api/v1/academic-years` list                    | PATCH/DELETE academic-years                    |
| `GET /api/v1/academic-years/{academicYearId}` detail | terms, classes, streams, subjects, enrollments |
| `POST /api/v1/academic-years` create (rev 1.2)       | Nested expansions                              |
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

## Locked product decisions (IMP-003-P0+)

1. **Keyset order:** `starts_on DESC NULLS LAST, id ASC`
2. **Dates:** optional null; DB enforces `ends_on >= starts_on` when both set
3. **Status enum:** `draft` \| `active` \| `closed`
4. **Create default status:** `draft` (safer than active)

## Acceptance (solo-operator)

| Role                           | Status | Date       |
| ------------------------------ | ------ | ---------- |
| API Contract Guardian (acting) | Signed | 2026-07-20 |
| Backend Lead (acting)          | Signed | 2026-07-20 |
| Security (acting)              | Signed | 2026-07-20 |

## Related

- DBF-003: [DBF-003-academic-years-list-slice.md](../database-freeze/DBF-003-academic-years-list-slice.md)
- Clone pattern: IMP-002-P0 students list
