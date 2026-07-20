# IMP-002-P1 — `GET /api/v1/students/{id}` (Student Detail)

## Outcome

Open tenant student **detail** under DBF-002 / ACF-002 rev 1.1: return one student in the session-bound tenant with `student.read`. Missing / cross-tenant / invalid id → **404** (no existence leak).

## Status

**Complete** (2026-07-20).

## Freezes / authority

| Artifact                   | Role                                    |
| -------------------------- | --------------------------------------- |
| DBF-002                    | `students` table + Pattern A RLS SELECT |
| ACF-002 rev **1.1**        | `getStudent` / `StudentEnvelope`        |
| Solo-operator SOLO-GOV-001 | Provisional acceptance honesty          |

## Endpoint

| Method | Path                    | Auth   | Header                 | AuthZ                                                    |
| ------ | ----------------------- | ------ | ---------------------- | -------------------------------------------------------- |
| `GET`  | `/api/v1/students/{id}` | Bearer | `X-Tenant-Id` required | `RequirePermission('student.read')` + session bind + RLS |

### Response 200 (`StudentEnvelope`)

Same allowlist as list item: `id`, `tenantId`, `studentCode`, `displayName`, `status`, `createdAt`, `updatedAt`.

### Errors

| Condition                                           | HTTP | Code                      |
| --------------------------------------------------- | ---- | ------------------------- |
| No auth                                             | 401  | `UNAUTHORIZED`            |
| No tenant header                                    | 400  | `TENANT_CONTEXT_REQUIRED` |
| Session mismatch / no `student.read`                | 403  | `FORBIDDEN`               |
| Invalid UUID / missing / other tenant / fail-closed | 404  | `NOT_FOUND`               |

## Implementation

| Layer      | Path                                                   |
| ---------- | ------------------------------------------------------ |
| Controller | `students.controller.ts` `getById` after list          |
| Service    | `getForTenant`                                         |
| Repository | `getByIdForTenant` — `tenant_id = $bound AND id = $id` |

## Explicit non-goals

- Writes, guardians, enrollments, grade expansions
- Fields beyond list allowlist

## Verification

```bash
npm run check
```

## Related

- List: [IMP-002-P0-students-list-read.md](./IMP-002-P0-students-list-read.md)
- Twin: [IMP-001-P12-users-get-by-id.md](./IMP-001-P12-users-get-by-id.md)
