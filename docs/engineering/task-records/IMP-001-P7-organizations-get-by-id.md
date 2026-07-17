# IMP-001 P7 — Product Increment: `GET /api/v1/organizations/{id}`

## Outcome

Open **organization detail** under ADR-012 / conditional freeze: return one organization in the session-bound tenant with `organization.read`. Missing / cross-tenant / invalid id → **404** (no existence leak).

## Status

**Complete** (2026-07-17).

## Endpoint

| Method | Path                        | Auth   | Header                     | AuthZ                                                                                                 |
| ------ | --------------------------- | ------ | -------------------------- | ----------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/v1/organizations/:id` | Bearer | **`X-Tenant-Id` required** | `RequirePermission('organization.read')` → session bind + membership-aware permission + RLS Pattern A |

Nest param `:id` corresponds to ACF `organizationId`.

**Response (200):** `{ "data": { …same fields as list item… } }`

**404 cases (generic `Organization not found.`):** missing row, other tenant / RLS deny, non-UUID id, pool unavailable, DB fail-closed null.

## Implementation

| Layer      | Change                                               |
| ---------- | ---------------------------------------------------- |
| Repository | `getByIdForTenant(userId, tenantId, organizationId)` |
| Service    | `getForTenant` → envelope or `AppError.notFound`     |
| Controller | `@Get(':id')` after list route                       |

## Explicit non-goals

- POST/PATCH/deactivate
- List pagination changes

## Verification

```bash
npm run check
```

## Related

- ACF-001 §4.3 / §3.7
- List: `IMP-001-P6-organizations-list-read.md`
- 404 pattern: tenants get-by-id
