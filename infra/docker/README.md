# Local Docker Platform

This directory documents ownership of local containerised development infrastructure.

The Compose file lives at the repository root (`docker-compose.yml`) for standard developer ergonomics. Runtime is limited to:

- PostgreSQL (local data volume, healthcheck)
- Redis (local data volume, healthcheck)

## Scope

- Local engineering only
- No production topology
- No cloud provider selection
- No database schema or migrations
- No application connection wiring in DEV-001

See `docs/engineering/development-environment.md` for commands and `docs/engineering/task-records/DEV-001-local-docker-platform.md` for task evidence.
