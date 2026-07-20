# IMP-001 P9 — Product Increment: `GET /api/v1/users`

## Outcome

Open the **tenant user directory list** product read under ADR-012 / solo-operator conditional freeze: list users visible via **active memberships** in the session-bound tenant with `user.read`, cursor pagination, and basic filters.

## Status

**Complete** (2026-07-20).

## Freezes / authority

| Artifact                                           | Role                                                 |
| -------------------------------------------------- | ---------------------------------------------------- |
| FREEZE_ACCEPTANCE_IDENTITY_TENANT Accepted v1.0    | Gate: product **read** open only                     |
| ACF-001 §4.5 Users                                 | `GET /users` + `user.read`                           |
| OpenAPI `listUsers` / `User` / `UserListEnvelope`  | Response + query contract                            |
| DBF-001 users + tenant_memberships + RLS Pattern C | Data + isolation                                     |
| ADR-012                                            | Exception for implementation; **writes stay closed** |

This task does **not** accept broader CRUD freeze exceptions.

## Endpoint

| Method | Path            | Auth   | Header                     | AuthZ                                                                                       |
| ------ | --------------- | ------ | -------------------------- | ------------------------------------------------------------------------------------------- |
| `GET`  | `/api/v1/users` | Bearer | **`X-Tenant-Id` required** | `RequirePermission('user.read')` → session↔header bind + membership-aware permissions + RLS |

### Query

| Param    | Behavior                                                                        |
| -------- | ------------------------------------------------------------------------------- |
| `limit`  | 1–100, default **25** (`parsePaginationQuery`)                                  |
| `cursor` | Opaque last-page user `id` (keyset on `(display_name, id)`)                     |
| `status` | Optional: `invited` \| `active` \| `disabled` \| `locked` (**User.status**)     |
| `search` | Optional: case-insensitive on `displayName` / `email` (ILIKE + metachar escape) |

### Response 200 (`UserListEnvelope`)

```json
{
  "data": [
    {
      "id": "uuid",
      "email": "…",
      "displayName": "…",
      "status": "active",
      "emailVerifiedAt": "…" | null,
      "lastLoginAt": "…" | null,
      "createdAt": "…",
      "updatedAt": "…"
    }
  ],
  "page": { "nextCursor": null, "limit": 25 }
}
```

**Never returned:** `password_hash`, tokens, secrets.

## Visibility rule

Users with **active** `tenant_memberships` row for the bound `tenant_id`.

Defense in depth:

1. App: `EXISTS (… m.tenant_id = $bound AND m.status = 'active')`
2. DB: RLS Pattern C `can_see_user` (self / platform / active member of `app.current_tenant`)
3. Transaction: `withTenantTransaction` sets GUCs for actor + bound tenant

**Note:** Membership-only `invited`/`suspended` without an **active** membership are not listed under current RLS helpers (matches `user_is_member_of_current_tenant`). Documented residual; changing RLS is out of scope.

## Implementation

| Layer      | Path                                                             |
| ---------- | ---------------------------------------------------------------- |
| Controller | `identity-and-access/controllers/users.controller.ts`            |
| Service    | `identity-and-access/application/users.service.ts`               |
| Repository | `identity-and-access/repositories/users.repository.ts`           |
| Module     | registers `UsersController` / `UsersRepository` / `UsersService` |

## Explicit non-goals

- `GET /users/{id}`, PATCH, disable, invite
- Role filter (deferred — needs clean RBAC join without N+1/leak risk)
- Cross-tenant / global user listing
- Write routes, RLS policy changes, new dependencies

## Tests

- Happy path + page meta
- Pagination / filter pass-through + validation
- Auth missing / tenant missing
- Repo: membership EXISTS, no `password_hash`, fail-closed, filter SQL params
- Controller structural: no create/update/remove methods

## Verification

```bash
npm run check
```

## Related

- Memberships list: [IMP-001-P6b-memberships-list-read.md](./IMP-001-P6b-memberships-list-read.md)
- List filters pattern: [IMP-001-P8-list-pagination-filtering.md](./IMP-001-P8-list-pagination-filtering.md)
