# IMP-001 P5d — Fail-closed warn-log + OpenAPI amend (list + get)

## Outcome

Close the P5 review follow-ups for membership-scoped tenant reads:

1. **Warn-log** on fail-closed DB errors in `AccessibleTenantsRepository` (same pattern as P4d).
2. **OpenAPI / ACF amend** so `GET /tenants` and `GET /tenants/{tenantId}` match the shipped AuthZ story.

## Status

**Complete** (2026-07-16).

## Change

| Area         | Detail                                                                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository   | `logFailClosedDbError` on `listAccessibleTenants` / `getAccessibleTenantById` catch paths                                                         |
| OpenAPI      | `GET /tenants` → `listAccessibleTenants` + `TenantListEnvelope`; get-by-id AuthZ notes (`session_tenant_bind`, path=`X-Tenant-Id`, `tenant.read`) |
| ACF-001 §4.2 | Table lists implemented reads; honesty + rev 1.2                                                                                                  |

## Files

- `apps/api/src/modules/tenant-and-billing/repositories/accessible-tenants.repository.ts`
- `apps/api/src/modules/tenant-and-billing/repositories/accessible-tenants.repository.test.ts`
- `docs/engineering/api-contract-freeze/openapi/acf-001-identity-tenant.openapi.yaml`
- `docs/engineering/api-contract-freeze/ACF-001-identity-tenant-slice.md`

## Related

- [IMP-001-P5-tenants-list-read.md](./IMP-001-P5-tenants-list-read.md)
- [IMP-001-P5b-tenants-get-by-id.md](./IMP-001-P5b-tenants-get-by-id.md)
- [IMP-001-P5c-tenants-get-requires-tenant-read.md](./IMP-001-P5c-tenants-get-requires-tenant-read.md)
- [IMP-001-P4d-fail-closed-ops-visibility.md](./IMP-001-P4d-fail-closed-ops-visibility.md) (pattern)
