# API Contract Freeze — Student Registry Slice (ACF-002)

## Freeze status

| Field               | Value                                                      |
| ------------------- | ---------------------------------------------------------- |
| Freeze ID           | `ACF-002`                                                  |
| Title               | API Contract Freeze — students list + get + create + patch |
| Version             | `1.4`                                                      |
| Date                | 2026-08-14                                                 |
| Authority           | Solo-operator provisional acceptance (SOLO-GOV-001)        |
| Companion DB freeze | DBF-002 (rev 1.2 update helper)                            |

**Honesty qualifier:** Accepted under solo-operator acting seats — **not** multi-party external review.

## Revision history

| Version | Date       | Notes                                                                             |
| ------- | ---------- | --------------------------------------------------------------------------------- |
| 1.0     | 2026-07-20 | List only (`listStudents`)                                                        |
| 1.1     | 2026-07-20 | Add `GET /students/{studentId}` (`getStudent`)                                    |
| 1.2     | 2026-07-20 | Add `POST /students` (`createStudent`)                                            |
| **1.3** | 2026-07-21 | Add `PATCH /students/{studentId}` (`patchStudent`)                                |
| **1.4** | 2026-08-14 | Add `GET /students/summary` KPI counts (IMP-048). Must register before `GET :id`. |

## Scope

| In scope                                             | Out of scope                                |
| ---------------------------------------------------- | ------------------------------------------- |
| `GET /api/v1/students` list                          | DELETE students                             |
| `GET /api/v1/students/{studentId}` detail            | Guardians, enrollments, grade/class filters |
| `POST /api/v1/students` create                       | Nested expansions                           |
| `PATCH /api/v1/students/{studentId}` patch (rev 1.3) |                                             |
| `GET /api/v1/students/summary` KPI counts (rev 1.4)  |                                             |
| Cursor pagination + status/search on list            |                                             |
| Permissions `student.read`, `student.manage`         |                                             |

Identity/Tenant ACF-001 remains unchanged and does **not** cover this path.

---

## Endpoint: list

| Method | Path               | Auth   | Header                     | AuthZ                                                                               |
| ------ | ------------------ | ------ | -------------------------- | ----------------------------------------------------------------------------------- |
| `GET`  | `/api/v1/students` | Bearer | `X-Tenant-Id` **required** | `RequirePermission('student.read')` + session↔header bind + active membership + RLS |

**operationId:** `listStudents`

### Query

| Param    | Behavior                                                                    |
| -------- | --------------------------------------------------------------------------- |
| `limit`  | 1–100, default **25** (`parsePaginationQuery`)                              |
| `cursor` | Opaque last-page student `id` (keyset on `(display_name, id)` ASC)          |
| `status` | Optional: `active` \| `inactive` \| `graduated` \| `transferred` \| `draft` |
| `search` | Optional: ILIKE on `displayName` / `studentCode` (metachar escape)          |

**Deferred:** grade, class, stream, academicYear, guardian filters.

### Success 200 — `StudentListEnvelope`

```json
{
  "data": [
    {
      "id": "uuid",
      "tenantId": "uuid",
      "studentCode": "…" | null,
      "displayName": "…",
      "status": "active",
      "createdAt": "…",
      "updatedAt": "…"
    }
  ],
  "page": { "nextCursor": null, "limit": 25 }
}
```

---

## Endpoint: summary (rev 1.4)

| Method | Path                       | Auth   | Header                     | AuthZ          |
| ------ | -------------------------- | ------ | -------------------------- | -------------- |
| `GET`  | `/api/v1/students/summary` | Bearer | `X-Tenant-Id` **required** | `student.read` |

**operationId:** `summarizeStudents`

Must be registered **before** `GET /students/:id` so `summary` is not captured as an id.

### Success 200

```json
{ "data": { "total": 0, "byStatus": { "active": 0 } } }
```

Owning-module COUNT. Product lists remain cursor-paginated with no COUNT.

---

## Endpoint: get by id (rev 1.1)

| Method | Path                           | Auth   | Header                     | AuthZ                                                                               |
| ------ | ------------------------------ | ------ | -------------------------- | ----------------------------------------------------------------------------------- |
| `GET`  | `/api/v1/students/{studentId}` | Bearer | `X-Tenant-Id` **required** | `RequirePermission('student.read')` + session↔header bind + active membership + RLS |

**operationId:** `getStudent`  
**Nest param:** `:id` (ACF `studentId`)

### Success 200 — `StudentEnvelope`

```json
{
  "data": {
    "id": "uuid",
    "tenantId": "uuid",
    "studentCode": "…" | null,
    "displayName": "…",
    "status": "active" | "inactive" | "graduated" | "transferred" | "draft",
    "createdAt": "…",
    "updatedAt": "…"
  }
}
```

**Same allowlist as list item** — never national IDs, guardian PII, secrets, free-form notes.

### Visibility

Student row must belong to the **bound tenant** (DBF-002 Pattern A / `tenant_id = bound`).  
Missing, other-tenant, invalid UUID, pool unavailable, or DB fail-closed → **404** (no existence leak). Generic message: `Student not found.`

### Errors (detail)

| Condition                              | HTTP | Code                                    |
| -------------------------------------- | ---- | --------------------------------------- |
| Missing/invalid bearer                 | 401  | `UNAUTHORIZED`                          |
| Missing `X-Tenant-Id`                  | 400  | `TENANT_CONTEXT_REQUIRED`               |
| Session ≠ header tenant                | 403  | `FORBIDDEN` (+ session mismatch reason) |
| No `student.read`                      | 403  | `FORBIDDEN`                             |
| Invalid UUID / missing / not in tenant | 404  | `NOT_FOUND`                             |
| Pool/DB fail-closed                    | 404  | `NOT_FOUND` (no leak)                   |

---

## Errors (list — unchanged)

| Condition                   | HTTP | Code                                      |
| --------------------------- | ---- | ----------------------------------------- |
| Missing/invalid bearer      | 401  | `UNAUTHORIZED`                            |
| Missing `X-Tenant-Id`       | 400  | `TENANT_CONTEXT_REQUIRED`                 |
| Session ≠ header tenant     | 403  | `FORBIDDEN` (+ session mismatch reason)   |
| No `student.read`           | 403  | `FORBIDDEN`                               |
| Invalid limit/status/cursor | 400  | `VALIDATION_ERROR`                        |
| Pool/DB fail-closed         | 200  | empty `{ data: [], page }` (list pattern) |

---

## Endpoint: create (rev 1.2)

| Method | Path               | Auth   | Header                     | AuthZ                                 | Idempotency  |
| ------ | ------------------ | ------ | -------------------------- | ------------------------------------- | ------------ |
| `POST` | `/api/v1/students` | Bearer | `X-Tenant-Id` **required** | `RequirePermission('student.manage')` | **Required** |

**operationId:** `createStudent`

### Request — `CreateStudentRequest`

```json
{
  "displayName": "Asha Juma",
  "studentCode": "STU-001",
  "status": "active"
}
```

| Field         | Required | Rules                                                                 |
| ------------- | -------- | --------------------------------------------------------------------- |
| `displayName` | **yes**  | string, trim, 1–200                                                   |
| `studentCode` | no       | optional; unique per tenant when set; format `^[A-Za-z0-9._-]{1,64}$` |
| `status`      | no       | default **`active`**; enum as list                                    |

`tenantId` always from bound `X-Tenant-Id` — **never** from body. Unknown top-level keys → `VALIDATION_ERROR`.

### Success 201 — `StudentEnvelope`

Same allowlist as GET detail (`data` Student).

### Errors (create)

| Condition                              | HTTP | Code                             |
| -------------------------------------- | ---- | -------------------------------- |
| Missing/invalid bearer                 | 401  | `UNAUTHORIZED`                   |
| Missing `X-Tenant-Id`                  | 400  | `TENANT_CONTEXT_REQUIRED`        |
| Missing Idempotency-Key                | 400  | `IDEMPOTENCY_KEY_REQUIRED`       |
| Session mismatch / no `student.manage` | 403  | `FORBIDDEN`                      |
| Invalid body                           | 400  | `VALIDATION_ERROR`               |
| Duplicate `studentCode` in tenant      | 409  | `CONFLICT`                       |
| Idempotency key reuse, different body  | 409  | `IDEMPOTENCY_KEY_REUSE_MISMATCH` |

---

## Endpoint: patch (rev 1.3)

| Method  | Path                           | Auth   | Header                     | AuthZ                                 | Idempotency  |
| ------- | ------------------------------ | ------ | -------------------------- | ------------------------------------- | ------------ |
| `PATCH` | `/api/v1/students/{studentId}` | Bearer | `X-Tenant-Id` **required** | `RequirePermission('student.manage')` | **Optional** |

**operationId:** `patchStudent`  
**Nest param:** `:id`

### Request — `UpdateStudentRequest`

Partial update; **at least one** field required. Allowlist only:

| Field         | Rules                                                               |
| ------------- | ------------------------------------------------------------------- |
| `displayName` | optional; string, trim, 1–200                                       |
| `studentCode` | optional; null clears; unique per tenant when set; format as create |
| `status`      | optional; enum active\|inactive\|graduated\|transferred\|draft      |

`tenantId` never from body. Unknown keys → `VALIDATION_ERROR`. Empty body → `VALIDATION_ERROR`.

### Success 200 — `StudentEnvelope`

Same allowlist as GET.

### Visibility / errors (patch)

| Condition                                           | HTTP | Code                               |
| --------------------------------------------------- | ---- | ---------------------------------- |
| Missing/invalid bearer                              | 401  | `UNAUTHORIZED`                     |
| Missing `X-Tenant-Id`                               | 400  | `TENANT_CONTEXT_REQUIRED`          |
| Session mismatch / no `student.manage`              | 403  | `FORBIDDEN`                        |
| Invalid body / empty patch                          | 400  | `VALIDATION_ERROR`                 |
| Invalid UUID / missing / other tenant / fail-closed | 404  | `NOT_FOUND` (`Student not found.`) |
| Duplicate `studentCode`                             | 409  | `CONFLICT`                         |
| Idempotency key reuse, different body               | 409  | `IDEMPOTENCY_KEY_REUSE_MISMATCH`   |

### Audit

On success: `student.patch` with metadata `{ fields: string[] }` (no PII).

## Acceptance (solo-operator)

| Role                           | Status | Date       | Notes |
| ------------------------------ | ------ | ---------- | ----- |
| API Contract Guardian (acting) | Signed | 2026-07-21 | v1.3  |
| Backend Lead (acting)          | Signed | 2026-07-21 | v1.3  |
| Security (acting)              | Signed | 2026-07-21 | v1.3  |

## Related

- OpenAPI: `docs/engineering/api-contract-freeze/openapi/acf-002-007-students-academic.openapi.yaml` (ASSURE-001; solo-operator, no re-sign)

- DBF-002: [DBF-002-student-registry-list-slice.md](../database-freeze/DBF-002-student-registry-list-slice.md)
- List: IMP-002-P0; Detail: IMP-002-P1; Create: IMP-002-P2; Patch: IMP-002-P3
