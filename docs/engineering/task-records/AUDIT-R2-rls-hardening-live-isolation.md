# AUDIT-R2: Audit Remediation Phase 2 — RLS Hardening & Live Isolation Tests

## Outcome

Close Independent Engineering Audit Critical gap **G3** (RLS INSERT GUC spoofing + live isolation evidence) under the conditional Identity & Tenant freeze acceptance.

## Status

**Complete for Phase 2 engineering deliverables.** Live suite executes when PostgreSQL is available; otherwise it skips unless `RUN_LIVE_DB_TESTS=1`.

## Issues addressed

| Audit ID | Issue                                       | Resolution                                                                                                               |
| -------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| G3       | INSERT policies allowed `rls_mode` OR alone | Forward migration requires `require_platform_write()` (AND of both GUCs)                                                 |
| G3       | educore_app could self-elevate via GUCs     | INSERT revoked from `educore_app`; granted only to `educore_platform`; `is_trusted_platform_session()` binds role + GUCs |
| G3       | No live Postgres isolation tests            | Added `tests/isolation/tenant-rls.live.test.ts` (adapted T1/T2/T3/T7)                                                    |

## Files created / modified

- `apps/api/db/migrations/20260714170000_rls_insert_hardening.up.sql` / `.down.sql`
- `apps/api/db/bootstrap/001_roles.sql` — `educore_platform`
- `tests/tooling/audit-r2-rls-hardening.test.ts`
- `tests/isolation/tenant-rls.live.test.ts`
- `scripts/db-bootstrap-roles.ts`
- `docs/engineering/gates/FREEZE_ACCEPTANCE_IDENTITY_TENANT.md` (residual risks)
- `tasks/plan-phase2.md`
- this task record

## Verification

```bash
npm run check
# With Docker Postgres running:
npm run docker:up
npm run db:migrate
npm run db:bootstrap-roles
# Optional hard fail if DB missing:
# RUN_LIVE_DB_TESTS=1 npm run test
```

## Residual risks

1. Host may lack Docker — live tests skip by design.
2. Membership tables still absent — full DBF T4–T8 (sessions/orgs) remain future work.
3. Formal human freeze signatures still required for unconditional GO.

## Non-goals confirmed

- No new business domain modules or HTTP APIs.
- No Design System / frontend work.
