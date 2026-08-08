# Local Docker Platform

This directory documents ownership of local containerised development infrastructure.

The Compose file lives at the repository root (`docker-compose.yml`) for standard developer ergonomics. Runtime is limited to:

- PostgreSQL (local data volume, healthcheck)
- Redis (local data volume, healthcheck)

## Prerequisite

**Docker Desktop (or equivalent Compose v2)** must be installed and on `PATH`. If `docker` is not recognized, install Docker Desktop for Windows, restart the terminal, then retry `npm run docker:up`.

Without Docker, `db:migrate`, `db:bootstrap-roles`, and live RLS isolation tests cannot run. Static tests and `npm run check` (with `RUN_LIVE_DB_TESTS` unset) still pass.

## Scope

- Local engineering only
- No production topology
- No cloud provider selection
- Compose does **not** bake business schema into the image; schema is applied via `npm run db:migrate` against the running Postgres
- NestJS is not auto-wired to these services in the skeleton bootstrap

**Staging / Fly:** API container image and Fly staging config live under `apps/api/Dockerfile` and `infra/fly/` (B-05 / FLY-DOCKER). That path is **not** this local Compose stack.

Migrations and RLS live under `apps/api/db/`. See `docs/engineering/development-environment.md` for commands and task records for DEV-001 / AUDIT-R2.
