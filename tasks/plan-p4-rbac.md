# Implementation Plan: IMP-001 Phase 4 (ADR-012) — RBAC Foundation

## Overview

Close the gap between **P2 RBAC scaffolding** (tables + `PgPermissionSource` + `RequirePermission`) and a **seedable, testable AuthZ path** wired to memberships and AuthN — still under **ADR-012**, without role-admin or tenant/user CRUD HTTP.

## Current baseline (do not rebuild)

| Asset                                                    | Status                                   |
| -------------------------------------------------------- | ---------------------------------------- |
| `roles` / `role_permissions` / `user_roles` + RLS        | Migration `20260715010000_roles_rbac`    |
| `app.user_permission_codes` (membership-gated)           | Exists                                   |
| `PgPermissionSource` + `MembershipAwarePermissionSource` | Wired in `RequestPlatformModule`         |
| `PolicyEvaluator` + `RequirePermission(...)`             | Exists                                   |
| Permission catalog seed                                  | Migration `20260714130000_seed_catalogs` |
| Role admin HTTP / tenant CRUD                            | **Closed** (non-goal)                    |

## Architecture decisions

1. **System role codes** follow DBF-001: `owner`, `admin`, `staff` (not ad-hoc product labels). Map casually: school_admin≈admin, teacher≈staff; platform operator is a DB role, not a tenant RBAC role.
2. **Writes** to RBAC tables only via trusted platform session (`educore_platform`) — same model as `seed:admin`. Runtime Nest pool stays `educore_app` (SELECT + SECURITY DEFINER helpers only).
3. **No new business routes.** Only enhance existing `GET /api/v1/auth/me` with effective `roles` + `permissions` when tenant is bound.
4. **Deny-by-default** remains: empty catalogue / inactive membership / fail-closed DB → no permissions.

## Permission matrices (seed baseline)

| Role    | Permission codes                                                                               |
| ------- | ---------------------------------------------------------------------------------------------- |
| `owner` | All `PERMISSION_CODES`                                                                         |
| `admin` | All except `entitlement.manage` (owner-only entitlement mutation)                              |
| `staff` | `tenant.read`, `organization.read`, `user.read`, `role.read`, `audit.read`, `entitlement.read` |

## Task slices

### Slice 1 — System role bootstrap library

- Pure module: matrices, ensure roles + role_permissions + optional user_roles assignment
- Idempotent; used by `seed:admin` and tests

### Slice 2 — Wire seed:admin

- After membership upsert: seed system roles for tenant; assign `owner` to seeded admin

### Slice 3 — Nest RBAC read path

- `RbacReadRepository` (roles for user in tenant under app GUCs)
- Inject `PolicyEvaluator` into `AuthService.me` for effective permission codes

### Slice 4 — Tests + docs

- Unit: RequirePermission guard, bootstrap matrices, seed config
- Structural tooling: no role-admin routes; migration/bootstrap presence
- Task record `IMP-001-P4-rbac-foundation.md`

## Non-goals

- Role / permission admin HTTP APIs
- Tenant or user CRUD
- MFA
- Opening domain modules
- Schema redesign (no new tables unless proven necessary)

## Verification

```bash
npm run check
# optional live:
# RUN_LIVE_DB_TESTS=1 npx vitest run tests/isolation/pg-permission-source.live.test.ts
```

## Risks

| Risk                                    | Mitigation                                                                  |
| --------------------------------------- | --------------------------------------------------------------------------- |
| Privilege escalation via seed matrices  | Document matrices; owner vs admin split; app role cannot INSERT roles       |
| me() leaks cross-tenant perms           | Only resolve for `activeTenantId` / session tenant; membership-aware source |
| ADR-012 countersignatures still pending | Task record states conditional freeze; no product Freeze claim              |
