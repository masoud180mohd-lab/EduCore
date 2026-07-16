# IMP-001 Phase P4 — RBAC Foundation (Roles, Permissions, RequirePermission)

## Outcome

Under **ADR-012 conditional freeze**, complete the **RBAC foundation** so AuthZ can resolve effective permission codes from `user_roles → roles → role_permissions → permissions`, integrated with **active tenant membership** and **P3 AuthN**, without opening role-admin or tenant/user CRUD HTTP.

## Status

**Complete** (2026-07-15) — foundation only; admin role APIs remain closed.

**Hardening follow-up (2026-07-15):** session↔header tenant bind on privileged guards + ops grant reconciler — see `IMP-001-P4b-rbac-session-bind-grant-reconcile.md`.

## Context

| Prior work    | Deliverable                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------------- |
| P2            | `roles` / `role_permissions` / `user_roles` migration + RLS + `app.user_permission_codes`       |
| P2            | `PgPermissionSource`, `MembershipAwarePermissionSource`, `PolicyEvaluator`, `RequirePermission` |
| P3            | Sessions, login, `/auth/me`, membership-bound tokens                                            |
| **P4 (this)** | System role matrices + seed bootstrap + RBAC read path on `/auth/me` + guard tests              |

## Deliverables

### System roles (DBF-001)

| Code    | Intent                       | Permission matrix (summary)                                    |
| ------- | ---------------------------- | -------------------------------------------------------------- |
| `owner` | Tenant owner                 | Full `PERMISSION_CODES` catalogue                              |
| `admin` | School / tenant admin        | All except `entitlement.manage`                                |
| `staff` | Ops / teacher-class baseline | Read-oriented: tenant/org/user/role/audit/entitlement **read** |

Product labels _school_admin_ ≈ `admin`, _teacher_ ≈ `staff`. Platform DB roles (`educore_app` / `educore_platform`) are **not** tenant RBAC roles.

### Bootstrap & seed

| Component                  | Path                                                            |
| -------------------------- | --------------------------------------------------------------- |
| Matrices                   | `apps/api/src/modules/identity-and-access/rbac/system-roles.ts` |
| Trusted-platform bootstrap | `.../rbac/system-role-bootstrap.ts`                             |
| Local admin seed           | `scripts/seed-local-admin.ts` → seeds roles + assigns **owner** |

Writes require `educore_platform` + trusted platform GUCs. Runtime Nest pool remains **SELECT-only** on RBAC tables.

### Nest read path

| Component                | Path                                                                |
| ------------------------ | ------------------------------------------------------------------- |
| `RbacReadRepository`     | List role summaries for user in tenant (app pool + tenant GUCs)     |
| `GET /api/v1/auth/me`    | Adds `roles[]` + `permissions[]` for **active session tenant** only |
| `RequirePermission(...)` | Existing factory guard; unit-tested                                 |

### Explicit non-goals

- Role / permission admin HTTP (`role.manage` routes)
- Tenant or user CRUD APIs
- MFA, relationships, delegations
- Schema redesign beyond existing `20260715010000_roles_rbac`

## Security notes

- **Deny-by-default:** empty membership or empty role assignments → no permissions.
- **Double gate:** `MembershipAwarePermissionSource` + SQL `user_has_active_membership` inside `app.user_permission_codes`.
- **No privilege write path** for `educore_app` on RBAC tables (INSERT/UPDATE/DELETE revoked).
- **me()** only resolves RBAC for the bound `activeTenantId` (no cross-tenant catalogue dump).
- **ADR-012:** Conditional freeze; DBF/ACF not human-accepted; do not claim product Freeze v1.0.

## Verification

```bash
npm run check
# optional live permission path:
# RUN_LIVE_DB_TESTS=1 npx vitest run tests/isolation/pg-permission-source.live.test.ts
# after seed:admin + API up: GET /api/v1/auth/me with Bearer token
```

## Recommended next

1. ADR-012 countersignatures / Freeze v1.0 (DBF-001 + ACF-001).
2. IMP-001 tenant core routes only after freezes (P4 in master plan is tenant CRUD — do not conflate with this RBAC foundation).
3. Role-admin APIs after formal Freeze + threat model.
4. Optional: wire `RequirePermission` on first privileged business route when authorized (session bind is already enforced).
5. Medium follow-ups: gate `/auth/me` roles via membership; warn-log fail-closed DB errors; me() RBAC field unit tests.
