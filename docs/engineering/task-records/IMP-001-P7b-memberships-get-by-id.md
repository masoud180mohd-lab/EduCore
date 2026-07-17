# IMP-001 P7b — Product Increment: `GET /api/v1/memberships/{id}`

## Outcome

Open **membership detail** under ADR-012 / conditional freeze: return one membership in the session-bound tenant roster with `user.read`. Missing / cross-tenant / invalid id → **404** (no existence leak).

## Status

**Complete** (2026-07-17).

## Scope note

Product memberships remain **tenant-roster** under bound `X-Tenant-Id` (ACF 4.6). Not cross-tenant “my memberships” (`/auth/me`).

## Endpoint

| Method | Path                      | Auth   | Header                     | AuthZ                                                                               |
| ------ | ------------------------- | ------ | -------------------------- | ----------------------------------------------------------------------------------- |
| `GET`  | `/api/v1/memberships/:id` | Bearer | **`X-Tenant-Id` required** | `RequirePermission('user.read')` → session bind + membership-aware permission + RLS |

Nest param `:id` corresponds to ACF `membershipId`.

**Response (200):** `{ "data": { …same core fields as list item… } }`

**404 cases (generic `Membership not found.`):** missing row, other tenant / RLS deny, non-UUID id, pool unavailable, DB fail-closed null.

## Implementation

| Layer      | Change                                             |
| ---------- | -------------------------------------------------- |
| Repository | `getByIdForTenant(userId, tenantId, membershipId)` |
| Service    | `getForTenant` → envelope or `AppError.notFound`   |
| Controller | `@Get(':id')` after list route                     |

## Explicit non-goals

- Invite / suspend / reactivate / remove
- Nested `user` expansion
- List pagination changes

## Verification

```bash
npm run check
```

## Related

- ACF-001 §4.6 / §3.7
- List: `IMP-001-P6b-memberships-list-read.md`
- Org detail: `IMP-001-P7-organizations-get-by-id.md`
