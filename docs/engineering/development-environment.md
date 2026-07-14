# Development Environment And Quality Baseline

## Status and scope

This document records Engineering Sprint 0 local development controls:

- `PLAT-002` quality tooling baseline
- `PLAT-003` / `PLAT-005` NestJS modular-monolith skeleton and boundary checks
- `DEV-001` local Docker platform (PostgreSQL + Redis)

It does **not** introduce a production domain model, database schema, API contract, provider selection, production topology, or production UI.

The immutable EduCore AI Development Kit in `EduCore/` remains authoritative.

## Prerequisites

- Node.js `>=20` and npm are required. The baseline was verified with Node.js `24.17.0` and npm `11.13.0`.
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

Provides empty PostgreSQL and Redis servers for local engineering. **No schema, migrations, or NestJS data wiring is included.**

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
- Business Identity/Tenant tables are **not** created in P0 (only migration meta)

## Database migrations (IMP-001 P0)

Tooling lives under `apps/api/db/` (see that README).

Current schema surface after `npm run db:migrate`:

- `schema_migrations` (ledger)
- Global catalogs: `permissions`, `plans` (+ seeds)
- RLS helpers in schema `app` (no tenant-owned tables yet)

```bash
npm run docker:up
npm run db:migrate           # apply pending *.up.sql
npm run db:bootstrap-roles   # educore_migrator + educore_app (local placeholders)
npm run db:migrate:down      # roll back last migration
npm run db:test-lifecycle    # print test DB guidance
```

Security rules:

- NestJS runtime must use **`educore_app`**, never migrator/superuser.
- FORCE RLS is mandatory from P1 on tenant-owned tables (see DBF-001).
- Migrate scripts redact connection URLs in logs.

P0 go/no-go: `docs/engineering/gates/IMP-001-P0-go-no-go.md` (P0 conditional GO; P1 blocked on formal freeze signatures).

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

`npm run check` is provider-neutral so it can be used by local development and the later hosted CI task without selecting a Git hosting or CI provider prematurely. It includes `boundaries:check` (PLAT-005). It does **not** require Docker to pass.

Backend skeleton layout and boundary rules are documented in `docs/engineering/backend-module-skeleton.md`.

Identity & Tenant design freezes + plan:

- Database: `docs/engineering/database-freeze/DBF-001-identity-tenant-slice.md`
- API contracts: `docs/engineering/api-contract-freeze/ACF-001-identity-tenant-slice.md`
- OpenAPI: `docs/engineering/api-contract-freeze/openapi/acf-001-identity-tenant.openapi.yaml`
- Implementation plan: `docs/engineering/implementation-plans/IMP-001-identity-tenant-implementation-plan.md`
- P0 gate: `docs/engineering/gates/IMP-001-P0-go-no-go.md`

P0 scaffolding is authorized (migration tooling only). **Do not start P1 business tables** until formal freeze signatures are recorded (see gate).

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
