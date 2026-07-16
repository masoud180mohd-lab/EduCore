# IMP-001 P5c — `GET /tenants/{id}` requires `tenant.read`

## Outcome

Align get-by-id with ACF-001 AuthZ stack for privileged tenant detail: **session bind +
`X-Tenant-Id` + `tenant.read`**, while keeping list as membership-only picker.

## Status

**Complete** (2026-07-16).

## Change

| Route                      | AuthZ                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------- |
| `GET /api/v1/tenants`      | Unchanged: `RequireAuthGuard` + RLS membership                                        |
| `GET /api/v1/tenants/{id}` | `RequirePermission('tenant.read')` (auth + header + session↔header bind + permission) |

Additional controller rule: **path `{id}` must equal `X-Tenant-Id`** (`TENANT_PATH_MISMATCH` → 403).
Prevents using permission on tenant A to request path B.

## Client requirements for get-by-id

1. Bearer access token with **session bound** to the tenant.
2. Header `X-Tenant-Id: <same uuid as path>`.
3. Effective permission `tenant.read` in that tenant (owner/admin/staff matrices include it).

## Files

- `apps/api/src/modules/tenant-and-billing/controllers/tenants.controller.ts`
- Controller + structural tests

## Related

- [IMP-001-P5b-tenants-get-by-id.md](./IMP-001-P5b-tenants-get-by-id.md)
- ACF-001 `GET /tenants/{tenantId}` `x-permissions: tenant.read`
