# IMP-001 P5b — Second Product Increment: `GET /api/v1/tenants/{id}`

## Outcome

Add membership-scoped **tenant detail** read under product increments (solo operator / freeze-gated implementation). Complements `GET /api/v1/tenants` (list).

## Status

**Complete** (2026-07-16).

## Endpoint

| Method | Path                   | Auth                                                                        | AuthZ                        |
| ------ | ---------------------- | --------------------------------------------------------------------------- | ---------------------------- |
| `GET`  | `/api/v1/tenants/{id}` | Bearer + `X-Tenant-Id` + session bind + `tenant.read` (`RequirePermission`) | RLS + path must match header |

> **Update (P5c):** get-by-id now requires `tenant.read` and path/`X-Tenant-Id` match. See `IMP-001-P5c-tenants-get-requires-tenant-read.md`.

**Response (200):**

```json
{
  "data": {
    "id": "uuid",
    "code": "demo-school",
    "name": "Demo School",
    "status": "active",
    "primaryLocale": "en",
    "timezone": "Africa/Dar_es_Salaam",
    "createdAt": "…",
    "updatedAt": "…"
  }
}
```

**Errors:**

| Condition                                                                     | Code           | Status  |
| ----------------------------------------------------------------------------- | -------------- | ------- |
| Missing / invalid Bearer                                                      | `UNAUTHORIZED` | 401     |
| Tenant missing **or** no active membership **or** pool off **or** non-UUID id | `NOT_FOUND`    | **404** |

404 is intentional for both “missing” and “no access” so clients cannot probe tenant existence across tenants.

## Implementation

| Layer                                                 | Change                                                  |
| ----------------------------------------------------- | ------------------------------------------------------- |
| `AccessibleTenantsRepository.getAccessibleTenantById` | `SELECT … WHERE id = $1` under `withUserRlsTransaction` |
| `TenantsService.getForUser`                           | Maps null → `AppError.notFound`                         |
| `TenantsController.getById`                           | `GET :id` + `RequireAuthGuard`                          |
| `AppError.notFound`                                   | Convenience factory                                     |

## Non-goals

- PATCH/DELETE/POST tenants
- `GET /tenants/current` (header-bound convenience)
- Opening other domain modules

## Verification

```bash
npm run check
```

## Related

- [IMP-001-P5-tenants-list-read.md](./IMP-001-P5-tenants-list-read.md)
- ACF-001 `GET /tenants/{tenantId}` — **P5c** adds `RequirePermission('tenant.read')` + path/header match.
