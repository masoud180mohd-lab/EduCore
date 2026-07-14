# AUDIT-R2 Live Evidence — 2026-07-14

## Result

**PASS.** Live tenant RLS isolation suite executed against local PostgreSQL 16.14 (Windows service `postgresql-x64-16`), not Docker Desktop.

```text
Test Files  1 passed (1)
Tests       5 passed | 1 skipped (6)
File        tests/isolation/tenant-rls.live.test.ts
```

Covered:

- educore_app cannot INSERT after GUC spoof (T7/G3)
- educore_platform INSERT fails with only `rls_mode` spoofed
- educore_platform INSERT succeeds with trusted platform session
- tenant A context cannot see tenant B (T1/T2 adapted)
- spoofed platform GUCs on educore_app do not list all tenants (T3 adapted)

## Environment used

| Item                             | Value                                                          |
| -------------------------------- | -------------------------------------------------------------- |
| Engine                           | PostgreSQL 16.14 (`C:\Program Files\PostgreSQL\16`)            |
| Host                             | `127.0.0.1:5432`                                               |
| Admin user for migrate/bootstrap | `postgres`                                                     |
| App roles                        | `educore_app`, `educore_platform` (after `db:bootstrap-roles`) |
| Flag                             | `RUN_LIVE_DB_TESTS=1`                                          |

## Docker note

Docker Desktop remains installed but **engine unhealthy** (HTTP 500 / `com.docker.service` stopped without Administrator). Live evidence therefore used the already-running local PostgreSQL 16 service — acceptable for G3 verification.

## How to re-run

```powershell
$env:DATABASE_URL = 'postgresql://postgres:educore_local_only@127.0.0.1:5432/educore'
$env:RUN_LIVE_DB_TESTS = '1'
npm run db:migrate
npm run db:bootstrap-roles
npm run test -- tests/isolation/tenant-rls.live.test.ts
```
