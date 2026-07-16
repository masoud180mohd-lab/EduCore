# IMP-001 P5c — Product Increment: `GET /api/v1/tenants/current`

## Outcome

Add convenience **current tenant** read for the session-bound tenant from `X-Tenant-Id`, with the same AuthZ stack as ACF-001 `getCurrentTenant` (auth + active membership + session bind + `tenant.read`).

## Status

**Complete** (2026-07-16).

## Endpoint

| Method | Path                      | Auth   | Header                     | AuthZ                                                                                                  |
| ------ | ------------------------- | ------ | -------------------------- | ------------------------------------------------------------------------------------------------------ |
| `GET`  | `/api/v1/tenants/current` | Bearer | **`X-Tenant-Id` required** | `RequirePermission('tenant.read')` → session↔header bind + membership-aware permission eval + RLS load |

**Response (200):** same `Tenant` envelope as get-by-id:

```json
{ "data": { "id": "…", "code": "…", "name": "…", "status": "…", … } }
```

**Errors (guard / service):**

| Condition                             | Code                                       | Status |
| ------------------------------------- | ------------------------------------------ | ------ |
| Missing Bearer / invalid token        | `UNAUTHORIZED`                             | 401    |
| Missing `X-Tenant-Id`                 | `TENANT_CONTEXT_REQUIRED`                  | 400    |
| Session not bound to a tenant         | `FORBIDDEN` (`SESSION_TENANT_UNBOUND`)     | 403    |
| Header ≠ session tenant               | `FORBIDDEN` (`SESSION_TENANT_MISMATCH`)    | 403    |
| No membership / missing `tenant.read` | `FORBIDDEN` / membership-aware empty perms | 403    |
| Tenant not visible under RLS          | `NOT_FOUND`                                | 404    |

## Implementation notes

- Route registered as `@Get('current')` **before** `@Get(':id')` so `current` is not parsed as a UUID path param.
- Reuses `TenantsService.getForUser(userId, tenant.tenantId)` (no new repository method).
- Session bind is enforced inside `RequirePermission` (P4b `assertSessionTenantMatchesHeader`).

## Non-goals

- Tenant switching (use existing `POST /api/v1/auth/select-tenant`)
- Write routes
- Changing RLS policies

## Verification

```bash
npm run check
```

## Related

- [IMP-001-P5-tenants-list-read.md](./IMP-001-P5-tenants-list-read.md)
- [IMP-001-P5b-tenants-get-by-id.md](./IMP-001-P5b-tenants-get-by-id.md)
- [IMP-001-P4b-rbac-session-bind-grant-reconcile.md](./IMP-001-P4b-rbac-session-bind-grant-reconcile.md)
- ACF-001 `GET /tenants/current`
