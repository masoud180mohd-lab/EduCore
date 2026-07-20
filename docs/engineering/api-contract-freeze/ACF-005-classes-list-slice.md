# API Contract Freeze — Classes List Slice (ACF-005)

## Freeze status

| Field               | Value                                               |
| ------------------- | --------------------------------------------------- |
| Freeze ID           | `ACF-005`                                           |
| Title               | API Contract Freeze — classes list-read             |
| Version             | `1.0`                                               |
| Date                | 2026-07-21                                          |
| Authority           | Solo-operator provisional acceptance (SOLO-GOV-001) |
| Companion DB freeze | DBF-005                                             |

**Honesty qualifier:** Solo-operator provisional — not multi-party external review.

## Revision history

| Version | Date       | Notes                     |
| ------- | ---------- | ------------------------- |
| **1.0** | 2026-07-21 | List only (`listClasses`) |

## Scope

| In scope                        | Out of scope                                   |
| ------------------------------- | ---------------------------------------------- |
| `GET /api/v1/classes` list      | POST/PATCH/DELETE (later revs)                 |
| Filters academicYearId / termId | Nested year/term objects; streams; enrollments |
| `academic.read`                 | `class.*` permission invention                 |

## Endpoint: list

| Method | Path              | Auth   | Header                     | AuthZ                                                     |
| ------ | ----------------- | ------ | -------------------------- | --------------------------------------------------------- |
| `GET`  | `/api/v1/classes` | Bearer | `X-Tenant-Id` **required** | `RequirePermission('academic.read')` + session bind + RLS |

**operationId:** `listClasses`

### Query

| Param            | Behavior                                                                 |
| ---------------- | ------------------------------------------------------------------------ |
| `limit`          | 1–100, default 25                                                        |
| `cursor`         | Opaque last id (keyset `name ASC, id ASC`)                               |
| `academicYearId` | Optional UUID; filter year in bound tenant; non-UUID → 400; miss → empty |
| `termId`         | Optional UUID; filter term in bound tenant; non-UUID → 400; miss → empty |
| `status`         | Optional draft\|active\|closed                                           |
| `search`         | Optional ILIKE name/code (escaped)                                       |

### Success 200 — `ClassListEnvelope`

```json
{
  "data": [
    {
      "id": "uuid",
      "tenantId": "uuid",
      "academicYearId": "uuid",
      "termId": null,
      "name": "Form 1A",
      "code": "F1A",
      "status": "active",
      "createdAt": "…",
      "updatedAt": "…"
    }
  ],
  "page": { "nextCursor": null, "limit": 25 }
}
```

Allowlist only.

### Errors

| Condition                           | HTTP | Code                    |
| ----------------------------------- | ---- | ----------------------- |
| No bearer                           | 401  | UNAUTHORIZED            |
| No X-Tenant-Id                      | 400  | TENANT_CONTEXT_REQUIRED |
| Session mismatch / no academic.read | 403  | FORBIDDEN               |
| Invalid limit/status/UUID filters   | 400  | VALIDATION_ERROR        |
| Fail-closed DB                      | 200  | empty page              |

## Acceptance (solo-operator)

| Role                         | Status | Date       |
| ---------------------------- | ------ | ---------- |
| Backend Lead (acting)        | Signed | 2026-07-21 |
| Security (acting)            | Signed | 2026-07-21 |
| Principal Architect (acting) | Signed | 2026-07-21 |

## Related

- DBF-005; IMP-003-C0
