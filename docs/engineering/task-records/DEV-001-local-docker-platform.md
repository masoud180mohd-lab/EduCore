# DEV-001: Local Docker Development Platform

## Outcome

Provide a secure, repeatable local Docker Compose platform with PostgreSQL and Redis so Engineering Sprint 0 developers can run approved infrastructure dependencies without selecting a cloud provider or inventing a database schema.

## Status

**Complete (file delivery + structural verification).** Runtime `docker compose up` verification requires Docker Desktop (or equivalent) on the engineer workstation; the delivery host for this task did not have Docker on PATH.

## Acceptance criteria

- `docker-compose.yml` defines PostgreSQL and Redis with volumes and healthchecks.
- Local-only environment example documents required variables without real secrets.
- npm scripts start/stop/inspect the platform.
- Developer documentation explains bootstrap and limits.
- `npm run check` still passes.
- No business logic, schema, migrations, or NestJS data wiring is introduced.
- Database / API / Design freezes remain unviolated.

## Non-goals

- Database Freeze outputs, ERD, RLS policies, migrations, ORM entities.
- Connecting NestJS application code to Postgres/Redis.
- Hosted CI Docker runners, Kubernetes, production compose stacks.
- PLAT-004 frontend work.

## Governing documents

- `EduCore/03_DEVELOPMENT_CONSTITUTION.md`
- `EduCore/39_ENGINEERING_EXECUTION_ROADMAP.md` (Sprint 0 local platform)
- `docs/engineering/development-environment.md`
- `docs/engineering/backend-module-skeleton.md`
- ADR-001 modular monolith (runtime deps only; no architecture change)

## Freeze-gate status

| Gate          | Status       | Impact                                              |
| ------------- | ------------ | --------------------------------------------------- |
| Architecture  | Accepted     | Local Postgres/Redis match approved stack direction |
| Database      | Not accepted | Compose provides empty server only; no schema       |
| API Contract  | Not accepted | No API changes                                      |
| Design System | Not accepted | No UI changes                                       |

## Security and safety notes

- Default passwords are weak and explicitly local-only.
- Ports bind to localhost-published host ports for developer convenience.
- No production secrets are committed.
- Application does not read Docker credentials in this task.
- Volumes persist local data only; destroy with `npm run docker:down -- -v` when needed.

## Implementation summary

- Root `docker-compose.yml` with `postgres` and `redis` services, named volumes, bridge network, healthchecks.
- `.env.docker.example` local variable defaults.
- npm scripts: `docker:up`, `docker:down`, `docker:ps`, `docker:logs`.
- Docs and structural tests updated.
- `infra/docker/README.md` ownership note.

## Verification evidence

Structural (always runnable):

```bash
npm run test -- tests/tooling/local-docker-platform.test.ts
npm run check
```

Runtime (requires Docker):

```bash
npm run docker:up
docker compose ps
# expect postgres and redis healthy
npm run docker:down
```

## Residual risks and deferrals

- Runtime compose verification depends on local Docker installation.
- Application configuration wiring to these services remains a later approved Sprint 0/1 task after Database Freeze / config foundation work.
- Hosted CI does not start these containers yet.
