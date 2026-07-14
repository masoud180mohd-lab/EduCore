# IMP-001 P2 Improvement — Nest PermissionSource from roles / role_permissions

## Outcome

Add Identity RBAC scaffolding (`roles`, `role_permissions`, `user_roles`) plus Nest `PgPermissionSource` so `PolicyEvaluator` can resolve permission codes from the database when the `educore_app` pool is enabled — still under ADR-012, **without** business HTTP routes.

## Status

**Complete** (2026-07-15).

## Changes

| Layer    | Deliverable                                                                        |
| -------- | ---------------------------------------------------------------------------------- |
| SQL      | Migration `20260715010000_roles_rbac` + RLS + `app.user_permission_codes`          |
| Nest     | `PgPermissionSource` wired as `MembershipAwarePermissionSource.INNER` when pool on |
| Fallback | `EmptyPermissionSource` when pool disabled (CI)                                    |
| Tests    | Unit, structural tooling, live suite                                               |

## Security

- `educore_app`: SELECT only on RBAC tables; INSERT/UPDATE via trusted platform session.
- `user_permission_codes`: SECURITY DEFINER; requires active membership + current_user GUC.
- Transaction-local GUCs via existing `withTenantTransaction`.
- No Identity/Tenant product controllers.

## Explicit non-goals

- Login / role admin HTTP
- System role seeding on tenant provision
- `organizations` FK (column nullable; FK deferred)
- TokenValidator

## Verification

```bash
npm run check
# optional: RUN_LIVE_DB_TESTS=1 npx vitest run tests/isolation/pg-permission-source.live.test.ts
```

## Recommended next

1. ADR-012 countersignatures / Freeze v1.0.
2. P3 AuthN `TokenValidator` after GO.
3. Tenant provision seed for baseline system roles (`owner` / `admin` / `staff`).
