# API Contract Freeze — Academic Years List Slice (ACF-003)

## Freeze status

| Field               | Value                                                      |
| ------------------- | ---------------------------------------------------------- |
| Freeze ID           | `ACF-003`                                                  |
| Title               | API Contract Freeze — GET /api/v1/academic-years list only |
| Version             | `1.0`                                                      |
| Date                | 2026-07-20                                                 |
| Authority           | Solo-operator provisional acceptance (SOLO-GOV-001)        |
| Companion DB freeze | DBF-003                                                    |

**Honesty qualifier:** Accepted under solo-operator acting seats — **not** multi-party external review.

## Scope

| In scope                          | Out of scope                                   |
| --------------------------------- | ---------------------------------------------- |
| `GET /api/v1/academic-years` list | POST/PATCH/DELETE academic-years               |
| Cursor pagination + status/search | GET by id                                      |
| Permission `academic.read`        | terms, classes, streams, subjects, enrollments |

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

## Locked product decisions (IMP-003-P0)

1. **Keyset order:** `starts_on DESC NULLS LAST, id ASC`
2. **Dates:** optional null; DB enforces `ends_on >= starts_on` when both set
3. **Status enum:** `draft` \| `active` \| `closed`

## Acceptance (solo-operator)

| Role                           | Status | Date       |
| ------------------------------ | ------ | ---------- |
| API Contract Guardian (acting) | Signed | 2026-07-20 |
| Backend Lead (acting)          | Signed | 2026-07-20 |
| Security (acting)              | Signed | 2026-07-20 |

## Related

- DBF-003: [DBF-003-academic-years-list-slice.md](../database-freeze/DBF-003-academic-years-list-slice.md)
- Clone pattern: IMP-002-P0 students list
