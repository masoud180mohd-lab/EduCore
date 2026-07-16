# IMP-001 P4b — RBAC Session Bind + Grant Reconciliation

## Outcome

Close the two **High** review findings from the Phase 4 RBAC foundation review, still under **ADR-012** (no business / role-admin routes).

## Status

**Complete** (2026-07-15).

## Issues addressed

| Priority | Finding                                                                              | Resolution                                                                                                                  |
| -------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| High     | Privileged guards evaluated `X-Tenant-Id` without requiring match to `auth.tenantId` | `assertSessionTenantMatchesHeader` in `RequirePermission` + `RequireActiveMembershipGuard`; AuthZ uses session-bound tenant |
| High     | Bootstrap can only add `role_permissions` (platform DELETE revoked)                  | Ops/migrator `reconcileSystemRoleGrantsForTenant` + `npm run rbac:reconcile-grants`                                         |

## Deliverables

### Session tenant binding

| Asset                          | Path                                                         |
| ------------------------------ | ------------------------------------------------------------ |
| Bind helper                    | `apps/api/src/common/auth/session-tenant-bind.ts`            |
| `RequirePermission`            | Uses bind → `evaluator.requireAny(userId, boundTenantId, …)` |
| `RequireActiveMembershipGuard` | Uses bind → membership check on `boundTenantId`              |
| Unit tests                     | mismatch → `FORBIDDEN` / `SESSION_TENANT_MISMATCH` (403)     |

Unbound session (`auth.tenantId` missing) → `FORBIDDEN` / `SESSION_TENANT_UNBOUND` (call `POST /auth/select-tenant` first).

### Grant reconciliation

| Asset      | Path                                                                           |
| ---------- | ------------------------------------------------------------------------------ |
| Library    | `apps/api/src/modules/identity-and-access/rbac/system-role-grant-reconcile.ts` |
| Ops script | `scripts/reconcile-system-role-grants.ts`                                      |
| npm script | `rbac:reconcile-grants`                                                        |

**Usage (privileged `DATABASE_URL` — migrator/superuser, not `educore_app`):**

```bash
npm run rbac:reconcile-grants -- --tenant-id=<uuid>
npm run rbac:reconcile-grants -- --all-tenants
```

Removes grants on **system** roles that are outside the current TypeScript matrices, then inserts any missing codes. Custom (non-system) roles are untouched.

## Security notes

- Header alone is no longer authoritative for privileged AuthZ.
- Nest app pool still cannot DELETE RBAC grants (least privilege preserved).
- Reconciler is offline ops only — not exposed over HTTP.

## Non-goals (unchanged)

- Business / role-admin HTTP routes
- Opening Freeze v1.0 without DBF/ACF signatures
- Org-scoped permission evaluation

## Verification

```bash
npm run check
```

Manual local exercise (login → me → refresh → logout + bind unit tests):

- `tasks/manual-test-p4b-rbac.md`

## Residual

- Medium items from review (`/auth/me` roles membership gate, fail-closed logging, me() RBAC unit asserts) remain open by design for a later slice.
- Formal Freeze signatures still pending.
