# EduCore

EduCore is an education operations platform for African schools. The immutable project constitution is in [`EduCore/`](EduCore/README.md); it governs every engineering change in this repository.

## Current delivery state

Engineering Sprint 0 / first-slice implementation transition is active. Platform foundation (PLAT-001–003, PLAT-005, DEV-001) is in place. **IMP-001** provisional migrations exist (`catalogs`, RLS helpers, `tenants` + `users`).

**Audit Remediation Phase 1 (2026-07-14)** addressed Critical G1/G2/G4: real git baseline, nested kit duplicate removed, and a **conditional** Identity & Tenant freeze acceptance record. See [`docs/engineering/gates/FREEZE_ACCEPTANCE_IDENTITY_TENANT.md`](docs/engineering/gates/FREEZE_ACCEPTANCE_IDENTITY_TENANT.md). Unrestricted domain coding remains **NO GO**.

Before starting any task, read [`EduCore/00_START_HERE.md`](EduCore/00_START_HERE.md) and follow the authority order it defines. Use only the canonical `EduCore/` kit root (no nested `EduCore/EduCore/`).

## Repository layout

The authoritative layout, ownership boundaries, and sequencing rules are in [`docs/engineering/repository-structure.md`](docs/engineering/repository-structure.md).

## Current engineering sequence

1. `PLAT-001` — define repository structure (complete).
2. `PLAT-002` — configure lint, formatting, strict TypeScript, test baseline, and local tooling (complete).
3. `PLAT-003` — create the backend module skeleton (complete).
4. `PLAT-004` — create the frontend app shell after the Design System Freeze.
5. `PLAT-005` — add enforceable module-boundary checks (complete).

No production feature work may begin until the applicable Database, API Contract, and Design System freezes for that slice are **formally accepted**. See [`docs/engineering/database-freeze/`](docs/engineering/database-freeze/) (DBF-001), [`docs/engineering/api-contract-freeze/`](docs/engineering/api-contract-freeze/) (ACF-001), and [`docs/engineering/implementation-plans/`](docs/engineering/implementation-plans/) (IMP-001).

## Quality baseline

See [`docs/engineering/development-environment.md`](docs/engineering/development-environment.md) for local setup, Docker platform commands, and the required `npm run check` quality gate.

```bash
npm install
npm run check
npm run docker:up      # requires Docker Desktop / Compose v2
npm run db:migrate     # P0 baseline meta only
npm run db:bootstrap-roles
```

## Backend skeleton

See [`docs/engineering/backend-module-skeleton.md`](docs/engineering/backend-module-skeleton.md) for the NestJS modular-monolith placeholder layout and neutral health endpoints.
