# IMP-001 P12 — `GET /api/v1/users/{id}` + Q5 list semantics

## Outcome

Complete AUDIT-R4 **Medium** product-read gaps:

1. **`GET /users/{userId}`** — detail with `user.read`, session bind, 404 on cross-tenant/missing.
2. **ACF Q5** — list with `status=invited` includes users with **invited** memberships in bound tenant.

## Status

**Complete** (2026-07-20).

## Endpoint

| Method | Path                 | AuthZ                            |
| ------ | -------------------- | -------------------------------- |
| `GET`  | `/api/v1/users/{id}` | `RequirePermission('user.read')` |

Default visibility: **active** membership in bound tenant (same as default list roster).
Invited-only users: use `GET /users?status=invited` (list); get-by-id requires active membership.

## Files

- `identity-and-access/controllers/users.controller.ts`
- `identity-and-access/application/users.service.ts`
- `identity-and-access/repositories/users.repository.ts`
- OpenAPI `getUser` x-authz notes

## Related

- [IMP-001-P9-users-list-read.md](./IMP-001-P9-users-list-read.md)
- [IMP-001-P11-list-validation-users-detail.md](./IMP-001-P11-list-validation-users-detail.md)
