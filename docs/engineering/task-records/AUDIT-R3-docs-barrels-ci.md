# AUDIT-R3: Audit Remediation Phase 3 — Docs, Barrels, CI Baseline

## Outcome

Close High audit gaps: documentation drift, public-barrel repository token exposure, and a provider-light CI quality gate.

## Status

**Complete** for Phase 3 engineering deliverables.

## Issues addressed

| Audit gap                                                     | Resolution                                                              |
| ------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Doc drift (skeleton / repo map / docker / PLAT-003 / dev-env) | Reconciled to current IMP-001 / AUDIT-R1–R2 state                       |
| Repository tokens on public barrels                           | Removed from all 14 `modules/*/index.ts`; boundary test asserts absence |
| No CI                                                         | Added `.github/workflows/quality-gate.yml` running `npm run check`      |

## Docker note (operator)

Phase 2 live RLS verification requires Docker Desktop. On this host `docker` was not on `PATH` (`ECONNREFUSED 127.0.0.1:5432`). That is an **environment prerequisite**, not an AUDIT-R3 code defect. After installing Docker:

```powershell
npm run docker:up
npm run db:migrate
npm run db:bootstrap-roles
$env:RUN_LIVE_DB_TESTS='1'
npm run test
```

Do **not** set `RUN_LIVE_DB_TESTS=1` until Postgres is reachable — the suite fails closed by design.

## Files

- Modified: 14 module barrels, boundary tests, engineering docs, README
- Created: `.github/workflows/quality-gate.yml`, `tasks/plan-phase3.md`, this task record

## Verification

```bash
npm run check
```

## Residual

- Docker install remains operator-owned
- Branch protection / required checks on the Git host still need human enablement after first push
- Formal DBF/ACF human signatures still open
