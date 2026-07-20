# IMP-001 P12 — `GET /api/v1/users/{id}` (User Detail)

## Outcome

Open the **tenant user directory detail** product read under ADR-012 / solo-operator conditional freeze: return one user visible via **active membership** in the session-bound tenant with `user.read`. Missing / cross-tenant / invalid id → **404** (no existence leak).

Also completed with AUDIT-R4 Medium follow-ups: ACF Q5 list `status=invited` semantics (see P11).

## Status

**Complete** (2026-07-20). Production path shipped earlier; VERIFY pass closed remaining test-matrix gaps (HTTP 400 missing tenant, well-formed unknown UUID → 404).

## Freezes / authority

| Artifact                                           | Role                                                 |
| -------------------------------------------------- | ---------------------------------------------------- |
| FREEZE_ACCEPTANCE_IDENTITY_TENANT Accepted v1.0    | Gate: product **read** open only                     |
| ACF-001 §4.5 Users                                 | `GET /users/{userId}` + `user.read`                  |
| OpenAPI `getUser` / `UserEnvelope`                 | Response contract                                    |
| DBF-001 users + tenant_memberships + RLS Pattern C | Data + isolation                                     |
| ADR-012                                            | Exception for implementation; **writes stay closed** |

## Endpoint

| Method | Path                 | Auth   | Header                     | AuthZ                                                                                       |
| ------ | -------------------- | ------ | -------------------------- | ------------------------------------------------------------------------------------------- |
| `GET`  | `/api/v1/users/{id}` | Bearer | **`X-Tenant-Id` required** | `RequirePermission('user.read')` → session↔header bind + membership-aware permissions + RLS |

### Response 200 (`UserEnvelope`)

```json
{
  "data": {
    "id": "uuid",
    "email": "…",
    "displayName": "…",
    "status": "active",
    "emailVerifiedAt": "…" | null,
    "lastLoginAt": "…" | null,
    "createdAt": "…",
    "updatedAt": "…"
  }
}
```

**Never returned:** `password_hash`, tokens, secrets.

### Error mapping

| Condition                                    | Status | Code                      |
| -------------------------------------------- | ------ | ------------------------- |
| Missing / invalid bearer                     | 401    | `UNAUTHORIZED`            |
| Missing `X-Tenant-Id`                        | 400    | `TENANT_CONTEXT_REQUIRED` |
| Session tenant ≠ header tenant               | 403    | `FORBIDDEN` (+ reason)    |
| No `user.read` / inactive membership (AuthZ) | 403    | `FORBIDDEN`               |
| Invalid UUID / missing / not in bound tenant | 404    | `NOT_FOUND`               |
| Pool unavailable / DB fail-closed            | 404    | `NOT_FOUND`               |

## Visibility rule

Target user must have an **active** `tenant_memberships` row for the bound `tenant_id` (default directory semantics; same as list without `status=invited`).

Defense in depth:

1. App: `RequirePermission('user.read')` (session bind + membership-aware permissions)
2. App SQL: `EXISTS (… m.tenant_id = $bound AND m.status = ANY(active…))`
3. DB: RLS Pattern C `can_see_user`
4. Transaction: `withTenantTransaction` sets GUCs for actor + bound tenant

**Note:** Invited-only users are not returned by get-by-id (active membership required). Use `GET /users?status=invited` for invited roster listing.

## Implementation

| Layer      | Path                                                                        |
| ---------- | --------------------------------------------------------------------------- |
| Controller | `identity-and-access/controllers/users.controller.ts` (`getById`)           |
| Service    | `identity-and-access/application/users.service.ts` (`getForTenant`)         |
| Repository | `identity-and-access/repositories/users.repository.ts` (`getByIdForTenant`) |

## Explicit non-goals

- PATCH / disable / invite / delete
- Cross-tenant or global user detail
- RLS policy changes
- Role-admin surfaces

## Tests (matrix)

| #   | Case                                   | Layer              | Expect             |
| --- | -------------------------------------- | ------------------ | ------------------ |
| 1   | Happy path active-member user          | controller/service | 200 `UserEnvelope` |
| 2   | Missing bearer                         | controller + HTTP  | 401                |
| 3   | Missing `X-Tenant-Id`                  | controller + HTTP  | 400                |
| 4   | Session ≠ header tenant                | HTTP               | 403                |
| 5   | Auth OK, no `user.read`                | HTTP               | 403                |
| 6   | Well-formed unknown UUID               | service + HTTP     | 404                |
| 7   | Malformed / non-UUID id                | service + HTTP     | 404                |
| 8   | Cross-tenant / no membership           | repo + service     | null → 404         |
| 9   | No `password_hash` in SQL/response     | repo unit          | allowlist          |
| 10  | Pool / DB fail-closed                  | repo + service     | null → 404         |
| 11  | No write methods on controller         | structural         | read-only          |
| 12  | `@Get(':id')` after list + `user.read` | structural P6–P9   | registered         |

Residual: invited-only users not on detail (active membership only). ACF “or self” not expanded — product path requires `user.read` (same as list).

## Verification

```bash
npm run check
```

## Related

- List: [IMP-001-P9-users-list-read.md](./IMP-001-P9-users-list-read.md)
- List validation / Q5: [IMP-001-P11-list-validation-users-detail.md](./IMP-001-P11-list-validation-users-detail.md)
- Parallel detail: [IMP-001-P7b-memberships-get-by-id.md](./IMP-001-P7b-memberships-get-by-id.md)
- AuthZ HTTP: [IMP-001-P10-live-read-isolation.md](./IMP-001-P10-live-read-isolation.md)
