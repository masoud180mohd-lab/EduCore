# API Contract Freeze — Terms List Slice (ACF-004)

## Freeze status

| Field               | Value                                               |
| ------------------- | --------------------------------------------------- |
| Freeze ID           | `ACF-004`                                           |
| Title               | API Contract Freeze — terms list-read only          |
| Version             | `1.0`                                               |
| Date                | 2026-07-20                                          |
| Authority           | Solo-operator provisional acceptance (SOLO-GOV-001) |
| Companion DB freeze | DBF-004                                             |

**Honesty qualifier:** Accepted under solo-operator acting seats — **not** multi-party external review.

## Revision history

| Version | Date       | Notes                   |
| ------- | ---------- | ----------------------- |
| **1.0** | 2026-07-20 | List only (`listTerms`) |

## Scope

| In scope                                            | Out of scope                                         |
| --------------------------------------------------- | ---------------------------------------------------- |
| `GET /api/v1/terms` list                            | POST/PATCH/DELETE terms                              |
| Cursor pagination + filters                         | Nested `/academic-years/{id}/terms` path (v1 closed) |
| Filter by optional `academicYearId`                 | classes, streams, subjects, enrollments              |
| Permission **`academic.read`** (reuse; no new code) | `term.read` / `term.manage` invention                |

Identity/Tenant ACF-001, Student ACF-002, Academic Years ACF-003 remain unchanged.

## Locked product decisions (D1–D10)

| #   | Decision                                                               |
| --- | ---------------------------------------------------------------------- |
| D1  | Path **`GET /api/v1/terms`** flat (like students / academic-years)     |
| D2  | Optional query `academicYearId` UUID — filter year **in bound tenant** |
| D3  | AuthZ: `RequirePermission('academic.read')`                            |
| D4  | Status enum: `draft` \| `active` \| `closed`                           |
| D5  | `startsOn` / `endsOn` optional null; both set ⇒ `endsOn >= startsOn`   |
| D6  | List order: `starts_on ASC NULLS LAST, id ASC`                         |
| D7  | Cursor: opaque keyset on last row `id` with order D6                   |
| D8  | Parent: `academic_year_id` FK + denormalized `tenant_id`               |
| D9  | Writes closed this increment                                           |
| D10 | `educore_app` SELECT only on `terms`                                   |

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

### Cross-tenant / missing year (security)

| Input                                            | Response                                                          |
| ------------------------------------------------ | ----------------------------------------------------------------- |
| `academicYearId` not a UUID                      | **400** `VALIDATION_ERROR` (strict query validation)              |
| Valid UUID for year missing or other-tenant year | **200 empty page** — no 403/404 that proves year exists elsewhere |

RLS + `tenant_id` bind ensure other-tenant terms never appear. Prefer empty list over existence leak.

### Success 200 — `TermListEnvelope`

```json
{
  "data": [
    {
      "id": "uuid",
      "tenantId": "uuid",
      "academicYearId": "uuid",
      "name": "Term 1",
      "code": "T1",
      "startsOn": "2026-01-15",
      "endsOn": "2026-04-15",
      "status": "active",
      "createdAt": "…",
      "updatedAt": "…"
    }
  ],
  "page": { "nextCursor": null, "limit": 25 }
}
```

| Field            | Notes                           |
| ---------------- | ------------------------------- |
| `academicYearId` | Parent year UUID                |
| `startsOn`       | ISO date `YYYY-MM-DD` or `null` |
| `endsOn`         | ISO date `YYYY-MM-DD` or `null` |
| `code`           | string or `null`                |

**Allowlist only** — no nested year/classes/streams.

### Errors

| Condition                          | HTTP | Code                                      |
| ---------------------------------- | ---- | ----------------------------------------- |
| Missing/invalid bearer             | 401  | `UNAUTHORIZED`                            |
| Missing `X-Tenant-Id`              | 400  | `TENANT_CONTEXT_REQUIRED`                 |
| Session ≠ header tenant            | 403  | `FORBIDDEN` (+ session mismatch reason)   |
| No `academic.read`                 | 403  | `FORBIDDEN`                               |
| Invalid limit / status / year UUID | 400  | `VALIDATION_ERROR`                        |
| Pool/DB fail-closed                | 200  | empty `{ data: [], page }` (list pattern) |

## Explicit non-goals

- Term writes (POST/PATCH/DELETE)
- Nested year path
- classes / streams / subjects
- New permission codes

## Acceptance (solo-operator)

| Role                         | Status | Date       |
| ---------------------------- | ------ | ---------- |
| Backend Lead (acting)        | Signed | 2026-07-20 |
| Security (acting)            | Signed | 2026-07-20 |
| Principal Architect (acting) | Signed | 2026-07-20 |

## Related

- Companion: [DBF-004-terms-list-slice.md](../database-freeze/DBF-004-terms-list-slice.md)
- Parent list twin: [ACF-003-academic-years-list-slice.md](./ACF-003-academic-years-list-slice.md)
- Implementation: IMP-003-P3 terms list read
