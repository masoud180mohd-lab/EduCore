# IMP-001 P2 Improvement — DB-backed TenantMembershipChecker

## Outcome

Wire Nest request-platform membership checks to the real `tenant_memberships` table (via `app.user_has_active_membership`) under an optional `educore_app` Postgres pool, without opening business HTTP routes and without breaking CI when Postgres is absent.

## Status

**Complete** (2026-07-15) under ADR-012 Conditional Freeze.

## Why

Phase P2 shipped fail-closed stubs (`DenyAllTenantMembershipChecker`, `EmptyPermissionSource`). SQL membership helpers were already real. Guards could not become production-ready until Nest had a safe pool + transaction-local GUC helper.

## Changes

| Area        | Change                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------ |
| Persistence | New `DatabaseModule` + optional `PG_POOL` (`educore_app` only)                                   |
| Config      | `EDUCORE_APP_DATABASE_URL` or `EDUCORE_ENABLE_APP_DB=1` — **never** generic `DATABASE_URL`       |
| Checker     | `PgTenantMembershipChecker` → `app.user_has_active_membership` in `withTenantTransaction`        |
| Wiring      | `RequestPlatformModule` factory: pool present → Pg checker; else DenyAll                         |
| Policy      | `MembershipAwarePermissionSource` wraps Empty catalogue; denies non-members first                |
| Guards      | `RequireActiveMembershipGuard` unchanged; now usable with real checker when pool on              |
| Tests       | Unit (mock pool), membership-aware policy, guard cases, structural P2 update, live checker suite |

## Security notes

- Transaction-local `set_config(..., true)` only — no sticky pool GUCs.
- Runtime role must be `educore_app` (explicit app URL).
- Invalid UUID / DB errors → `false` (fail-closed → 403 via guard).
- One membership check = one short transaction (not N+1 per permission code). Permission catalogue still empty until roles land.
- No Identity/Tenant product HTTP routes added.

## Explicit remaining interfaces (by design)

| Component                 | Still stub / empty                            | Why                                         |
| ------------------------- | --------------------------------------------- | ------------------------------------------- |
| `TOKEN_VALIDATOR`         | `RejectAllTokenValidator`                     | AuthN / sessions gated (P3 + freeze)        |
| Inner `PERMISSION_SOURCE` | ~~Empty~~ → `PgPermissionSource` when pool on | See `IMP-001-P2-roles-permission-source.md` |
| Idempotency store         | In-memory                                     | No mutation routes yet                      |
| Audit publisher           | Noop                                          | Outbox / `audit_events` later               |

## Enable locally

```bash
# Preferred
set EDUCORE_APP_DATABASE_URL=postgresql://educore_app:educore_app_local_only@127.0.0.1:5432/educore

# Or default local app URL
set EDUCORE_ENABLE_APP_DB=1
```

Without these flags, Nest keeps DenyAll (CI-safe).

## Verification

```bash
npm run check
# optional live:
# RUN_LIVE_DB_TESTS=1 npx vitest run tests/isolation/pg-membership-checker.live.test.ts
```

## Risks reduced

| Risk                                         | Mitigation                                        |
| -------------------------------------------- | ------------------------------------------------- |
| Deny-all forever after SQL memberships exist | Pg checker + factory when pool enabled            |
| Migrator URL accidental in Nest              | No `DATABASE_URL` fallback for app pool           |
| Pool GUC contamination                       | `withTenantTransaction` BEGIN/COMMIT + `is_local` |
| Non-member passing RequirePermission alone   | `MembershipAwarePermissionSource`                 |

## Recommended next

1. Complete ADR-012 countersignatures / Freeze v1.0 track.
2. Nest role/`role_permissions` PermissionSource (still no HTTP until freeze GO). → **done:** `IMP-001-P2-roles-permission-source.md`.
3. P3 AuthN `TokenValidator` after GO (or new ADR).
4. Optional request-scoped membership/permission cache if guards stack on one request.

## Related

- ADR-012, FREEZE-ACC-001
- IMP-001-P2 task record (original plumbing)
- IMP-001-P1 memberships + OpenAPI
