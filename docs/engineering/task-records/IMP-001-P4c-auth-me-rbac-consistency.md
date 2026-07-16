# IMP-001 P4c — `/auth/me` RBAC Consistency (roles ↔ permissions)

## Outcome

Close the **Medium** review finding: `GET /api/v1/auth/me` could return `roles[]` from `RbacReadRepository` while `permissions[]` were empty after membership revoke (permissions already membership-gated via `MembershipAwarePermissionSource`).

## Status

**Complete** (2026-07-16).

## Problem

| Field           | Pre-fix path                                             | Membership gate               |
| --------------- | -------------------------------------------------------- | ----------------------------- |
| `permissions[]` | `MembershipAwarePermissionSource` → `PgPermissionSource` | Yes (checker + SQL helper)    |
| `roles[]`       | `RbacReadRepository.listRolesForUser` only               | **No** (assignment rows only) |

After membership revoke, a stale session tenant could still list role codes while effective permissions were empty — inconsistent AuthZ self-view.

## Resolution

1. **`AuthService.me`** — single `sessions.hasActiveMembership(userId, activeTenantId)` gate before loading **both** roles and permissions. Inactive / missing membership → both arrays empty (RBAC loaders not called).
2. **`RbacReadRepository`** — SQL requires `tenant_memberships.status = 'active'` (defense in depth if called outside `me`).
3. **Unit tests** — active membership returns RBAC fields; inactive membership returns empty roles + permissions without calling loaders; unbound tenant skips RBAC entirely.

## Files

| Path                                                                         | Change                                  |
| ---------------------------------------------------------------------------- | --------------------------------------- |
| `apps/api/src/modules/identity-and-access/auth/auth.service.ts`              | Membership gate for roles + permissions |
| `apps/api/src/modules/identity-and-access/rbac/rbac-read.repository.ts`      | Active membership join                  |
| `apps/api/src/modules/identity-and-access/auth/auth.service.test.ts`         | Consistency cases                       |
| `apps/api/src/modules/identity-and-access/rbac/rbac-read.repository.test.ts` | SQL membership gate                     |

## Non-goals

- New privileged business routes
- Changing `PolicyEvaluator` / `RequirePermission` session-bind (P4b)
- Role-admin HTTP

## Verification

```bash
npm run check
# or focused:
npx vitest run apps/api/src/modules/identity-and-access/auth/auth.service.test.ts \
  apps/api/src/modules/identity-and-access/rbac/rbac-read.repository.test.ts
```

## Related

- [IMP-001-P4-rbac-foundation.md](./IMP-001-P4-rbac-foundation.md)
- [IMP-001-P4b-rbac-session-bind-grant-reconcile.md](./IMP-001-P4b-rbac-session-bind-grant-reconcile.md)
