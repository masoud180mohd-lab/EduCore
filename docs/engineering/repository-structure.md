# Repository Structure

## Status and authority

This document is the `PLAT-001` repository map. It implements the Engineering Sprint 0 task **Define repo structure** from `EduCore/39_ENGINEERING_EXECUTION_ROADMAP.md` without selecting dependencies or implementing a product feature.

The immutable EduCore AI Development Kit in `EduCore/` remains the source of truth. In a conflict, follow `EduCore/03_DEVELOPMENT_CONSTITUTION.md`, accepted ADRs, and the authority order in `EduCore/00_START_HERE.md`.

## Topology

```text
.
|- EduCore/                 Immutable AI Development Kit v2.0
|- apps/
|  |- api/                  NestJS modular-monolith skeleton (PLAT-003)
|  `- web/                  Reserved Next.js web application root
|- packages/                Future shared technical primitives only
|- docs/
|  `- engineering/          Engineering records, freezes, and guidance
|     |- database-freeze/   Accepted/proposed Database Freeze packages
|     |- api-contract-freeze/ Accepted/proposed API Contract Freeze packages
|     |- implementation-plans/ Spec-driven implementation plans (e.g. IMP-001)
|     |- gates/               Go/No-Go and freeze acceptance records
|     |- decisions/           Repository ADRs (e.g. ADR-012 exception)
|     `- templates/           Engineering PR checklists
|- infra/
|  `- docker/               Local Docker platform notes (DEV-001)
|- docker-compose.yml       Local PostgreSQL + Redis (DEV-001)
|- scripts/                 Repository automation (check, migrate, docker)
`- tests/                   Tooling, contract harness, cross-workspace tests
```

`apps/api` contains the NestJS skeleton (PLAT-003), boundary enforcement (PLAT-005), and database tooling under `apps/api/db/` (migrations through Imp-001 / AUDIT-R2: catalogs, RLS helpers, `tenants`/`users`, platform role hardening). Identity & Tenant freezes: DBF-001 / ACF-001 remain **conditionally** accepted — see `docs/engineering/gates/FREEZE_ACCEPTANCE_IDENTITY_TENANT.md`. No NestJS domain business controllers yet.

## Boundary rules

- `apps/api` is the NestJS modular monolith required by ADR-001. Bounded contexts communicate through public barrels (`modules/<context>/index.ts`) or future domain events; direct cross-module internal imports are prohibited. Repository tokens are **not** exported on public barrels (AUDIT-R3).
- Automated enforcement is provided by `dependency-cruiser` (`.dependency-cruiser.cjs`) via `npm run boundaries:check`, which is part of `npm run check` (PLAT-005).
- `apps/web` is reserved for the future Next.js application. Production UI remains blocked until the applicable Design System Freeze is accepted.
- `packages` may contain only shared, dependency-light technical primitives with a single documented owner. It must not become a backdoor for business-domain coupling or an unfrozen API contract.
- `tests` may hold cross-workspace test support only. Tenant-isolation, authorization, finance, offline, and AI test suites are introduced only with their approved domain work.
- `infra` may hold local development automation (for example Docker notes). It must not select cloud, region, secret manager, or production deployment topology before the required ADR and readiness evidence.
- `EduCore` is documentation, not application source. Its frozen and controlled records are not edited as part of implementation work unless a governance process explicitly authorizes it.

## Sequencing constraints

`PLAT-001`–`PLAT-003`, `PLAT-005`, and `DEV-001` are complete for repository topology, tooling baseline, NestJS skeleton, module-boundary enforcement, and local Docker Postgres/Redis.

Before `PLAT-004`, the Design System Freeze must be accepted. Production domain features remain blocked until Database and API Contract freezes for the target slice are accepted. After freezes, follow the slice implementation plan (e.g. IMP-001) before broad coding.

## Ownership and change control

| Area                | Accountable engineering role            | Change rule                                                                                                   |
| ------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Repository topology | Principal Architect / Engineering Lead  | Material topology changes require architecture review; changes that alter frozen architecture require an ADR. |
| `apps/api`          | Backend Engineering                     | Module ownership follows the bounded contexts in `EduCore/35_PROJECT_ARCHITECTURE.md`.                        |
| `apps/web`          | Frontend Engineering                    | Production UI requires Design System Freeze evidence.                                                         |
| `packages`          | Owning platform or bounded-context team | Every shared package needs a documented owner and public surface before creation.                             |
| `infra`             | Platform / SRE Engineering              | Provider and recovery decisions require the applicable ADR and readiness evidence.                            |
| `tests`             | QA Engineering with domain owners       | Risk-based suites follow `EduCore/11_TESTING_GUIDELINES.md`.                                                  |

Reviewer assignments and branch protections are deferred to their dedicated Sprint 0 work because no organization-specific owner identities or hosting platform have been approved.
