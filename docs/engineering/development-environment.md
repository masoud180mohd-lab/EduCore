# Development Environment And Quality Baseline

## Status and scope

This document records Engineering Sprint 0 local development controls:

- `PLAT-002` quality tooling baseline
- `PLAT-003` / `PLAT-005` NestJS modular-monolith skeleton and boundary checks
- `DEV-001` local Docker platform (PostgreSQL + Redis)
- IMP-001 / AUDIT-R2 database migrations and RLS under `apps/api/db/`
- AUDIT-R3 hosted CI quality gate (`.github/workflows/quality-gate.yml`)

NestJS still has **no** production domain HTTP routes. Persistence for Identity/Tenant is provisional SQL under conditional freeze acceptance — see `docs/engineering/gates/FREEZE_ACCEPTANCE_IDENTITY_TENANT.md`.

The immutable EduCore AI Development Kit in `EduCore/` remains authoritative.

## Prerequisites

- Node.js `>=22` and npm are required (CI uses Node 22; `dependency-cruiser` does not support Node 20). The baseline was verified with Node.js `24.17.0` and npm `11.13.0`.
- Docker Desktop (or Docker Engine + Compose v2) is required only for the local data platform (`npm run docker:up`).
- Copy `.env.example` to `.env` only when a task needs local application configuration. `.env` is ignored and must never contain committed secrets.
- Optional Docker overrides: copy `.env.docker.example` to `.env.docker` (also ignored). Default scripts use `.env.docker.example` for bootstrap simplicity.

## Bootstrap (tooling only)

```bash
npm install
npm run check
```

A clean checkout must restore lockfile-pinned tooling and pass the full quality gate before any implementation work begins.

## Local Docker platform (DEV-001)

Provides PostgreSQL and Redis for local engineering. Compose does not embed schema; apply SQL with `npm run db:migrate` after containers are healthy.

**If `docker` is not recognized:** either:

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows), start it, open a **new** terminal, then `npm run docker:up`, or
2. Use a local PostgreSQL 16+ on `127.0.0.1:5432` with database/user credentials matching DEV-001 defaults (`educore` / `educore_local_only`, or set `DATABASE_URL` / `POSTGRES_*`).

Without Postgres, skip data-platform commands; `npm run check` still works and live RLS tests **skip** unless `RUN_LIVE_DB_TESTS=1` (which fails hard without Postgres — by design).

**One-shot live RLS verification (PowerShell, after Postgres is up):**

```powershell
.\scripts\run-live-db-tests.ps1
# or:
npm run db:migrate
npm run db:bootstrap-roles
$env:RUN_LIVE_DB_TESTS='1'
npm run test -- tests/isolation/tenant-rls.live.test.ts
```

### Start

```bash
npm run docker:up
```

This runs:

```bash
docker compose --env-file .env.docker.example up -d --wait
```

`--wait` blocks until service healthchecks pass.

### Inspect

```bash
npm run docker:ps
npm run docker:logs
```

### Stop

```bash
npm run docker:down
```

Remove local volumes (destroys local DB/Redis data):

```bash
docker compose --env-file .env.docker.example down -v
```

### Default local endpoints

| Service    | Host endpoint    | Notes                                            |
| ---------- | ---------------- | ------------------------------------------------ |
| PostgreSQL | `localhost:5432` | user/db `educore`, password `educore_local_only` |
| Redis      | `localhost:6379` | password `educore_local_only`                    |

These credentials are **local-only placeholders**. Do not reuse them in staging or production. Change them via `.env.docker` if needed.

### Explicit non-goals for Docker platform

- No production compose stack, Kubernetes, or cloud topology
- NestJS runtime is not auto-connected to Postgres/Redis in the skeleton bootstrap

## Database migrations (IMP-001 / AUDIT-R2)

Tooling lives under `apps/api/db/` (see that README).

Current schema surface after a successful `npm run db:migrate` (requires Docker Postgres):

- `schema_migrations` ledger
- Global catalogs: `permissions`, `plans` (+ seeds)
- RLS helpers in schema `app`
- Provisional `tenants` / `users` tables with FORCE RLS
- AUDIT-R2 hardening: `educore_platform` role; runtime `educore_app` cannot INSERT tenants/users

```bash
npm run docker:up
npm run db:migrate           # apply pending *.up.sql
npm run db:bootstrap-roles   # migrator + app + platform (local placeholders)
npm run db:migrate:down      # roll back last migration
npm run db:test-lifecycle    # print test DB guidance
```

Live isolation suite:

```powershell
# Only after Docker Postgres is up and migrations applied:
$env:RUN_LIVE_DB_TESTS='1'
npm run test
```

Security rules:

- NestJS runtime must use **`educore_app`**, never migrator, platform, or superuser.
- FORCE RLS is mandatory on tenant-owned tables.
- Migrate scripts redact connection URLs in logs.

Governance: `docs/engineering/gates/FREEZE_ACCEPTANCE_IDENTITY_TENANT.md` (conditional GO; full freeze signatures still open).

## Commands

| Command                         | Purpose                                                |
| ------------------------------- | ------------------------------------------------------ |
| `npm install`                   | Restore the lockfile-pinned development tooling.       |
| `npm run env:check`             | Validate the non-secret `NODE_ENV` setting.            |
| `npm run format`                | Apply Prettier formatting to repository files.         |
| `npm run format:check`          | Verify formatting without changing files.              |
| `npm run lint`                  | Run strict TypeScript-aware ESLint checks.             |
| `npm run typecheck`             | Compile-check TypeScript with no emitted output.       |
| `npm run test`                  | Run the neutral Vitest foundation suite.               |
| `npm run boundaries:check`      | Enforce NestJS modular-monolith import boundaries.     |
| `npm run db:migrate`            | Apply SQL migrations (P0 baseline meta only).          |
| `npm run db:migrate:down`       | Roll back the last SQL migration.                      |
| `npm run db:bootstrap-roles`    | Create local `educore_app` / `educore_migrator` roles. |
| `npm run db:test-lifecycle`     | Print (or run) test DB lifecycle helper.               |
| `npm run docker:up`             | Start local PostgreSQL + Redis (healthy).              |
| `npm run docker:down`           | Stop local Docker services.                            |
| `npm run docker:ps`             | Show local Docker service status.                      |
| `npm run docker:logs`           | Tail local Docker service logs.                        |
| `npm run check`                 | Run all required quality checks in CI-ready order.     |
| `npm run start -w @educore/api` | Start the NestJS API skeleton (health endpoints only). |

`npm run check` is provider-neutral and is also run by `.github/workflows/quality-gate.yml` (AUDIT-R3). It includes `boundaries:check` (PLAT-005). It does **not** require Docker to pass (live RLS tests skip without Postgres unless `RUN_LIVE_DB_TESTS=1`).

Backend skeleton layout and boundary rules: `docs/engineering/backend-module-skeleton.md`.

Identity & Tenant governance:

- Conditional freeze acceptance: `docs/engineering/gates/FREEZE_ACCEPTANCE_IDENTITY_TENANT.md`
- Database draft: `docs/engineering/database-freeze/DBF-001-identity-tenant-slice.md`
- API contracts: `docs/engineering/api-contract-freeze/ACF-001-identity-tenant-slice.md`
- Implementation plan: `docs/engineering/implementation-plans/IMP-001-identity-tenant-implementation-plan.md`

Unrestricted domain coding remains **NO GO** until full freeze signatures and remaining freeze conditions close.

## Workspace standards

- The root workspace is private and has no production dependencies.
- npm writes exact dependency versions and the committed lockfile is the reproducible source for tooling resolution.
- TypeScript uses strict mode plus exact optional-property, unchecked-index, unused-code, and return-path checks.
- ESLint uses type-aware TypeScript rules and treats warnings as failures.
- Prettier, EditorConfig, and Git attributes enforce UTF-8/LF, two-space indentation, final newlines, and consistent formatting.
- Tests use the Node environment. Domain-specific integration, tenant isolation, authorization, finance, offline, AI, and end-to-end suites remain gated to their approved work.

## Environment safety

Application tooling validates only `NODE_ENV` in the PLAT-002 baseline. Accepted values are `development`, `test`, and `production`; an omitted value defaults to `development` for local tooling. The validator never prints an invalid value.

Docker credentials live in `.env.docker.example` / optional `.env.docker` and are separate from the application `.env` baseline. Do not commit real secrets. Hosted secret managers and production configuration remain later approved work.

## Quality gate contract

`npm run check` must pass before a task is considered complete:

1. `format:check`
2. `lint`
3. `typecheck`
4. `test`
5. `env:check`
6. `boundaries:check`

## Rollback

- Tooling baseline changes are reversible through a Git revert.
- Docker local data can be discarded with `docker compose ... down -v`.
- There is no production migration, deployment, feature flag, or runtime rollback requirement for this local platform.
