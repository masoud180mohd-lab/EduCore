# Backend Module Skeleton (PLAT-003 / PLAT-005)

## Status and scope

This document records the NestJS modular-monolith skeleton created by Engineering Sprint 0 task `PLAT-003` and the enforceable module-boundary checks added by `PLAT-005`.

It does **not** introduce:

- database schema, migrations, or persistence adapters
- business API routes or contracts
- authentication providers, JWT/session implementation, or tenant provisioning
- Docker, hosted CI, or cloud topology

## Location

- Workspace package: `apps/api` (`@educore/api`)
- Entry point: `apps/api/src/main.ts`
- Composition root: `apps/api/src/app.module.ts`
- Boundary rules: `.dependency-cruiser.cjs`
- Boundary runner: `scripts/check-module-boundaries.mjs`

## Platform common layer

| Area        | Path                      | Purpose                                                      |
| ----------- | ------------------------- | ------------------------------------------------------------ |
| Config      | `src/common/config/`      | Typed non-secret config (`NODE_ENV`, `PORT`, `SERVICE_NAME`) |
| Health      | `src/common/health/`      | Neutral `/health` and `/ready` endpoints                     |
| Correlation | `src/common/correlation/` | `x-correlation-id` middleware                                |
| Errors      | `src/common/errors/`      | Typed `AppError` and client-safe error envelope              |
| Logging     | `src/common/logging/`     | Structured logger interface with field redaction             |
| Events      | `src/common/events/`      | Domain-event type and no-op publisher placeholder            |

Modules may depend on `src/common/**`. The common layer must not depend on any bounded-context module.

## Bounded-context modules

Each context follows `EduCore/08_BACKEND_GUIDELINES.md` folder shape:

- module definition
- controllers (placeholder, no business routes)
- application services (placeholder)
- domain services (placeholder)
- repositories (interface + non-persistent placeholder)
- DTOs (neutral skeleton only)
- policies (deny-by-default placeholder)
- events (event-name placeholders)
- smoke tests
- **public API barrel** (`index.ts`) — the only cross-module import surface

Registered contexts (ADR-001 / architecture map):

1. Identity And Access
2. Tenant And Billing
3. Student Registry
4. Academic Structure
5. Attendance
6. Assessment
7. Finance Ledger
8. Payments
9. Communication
10. Documents And Files
11. AI Insights
12. Integrations
13. Analytics
14. Platform Operations

## Public API convention

Each bounded context exposes a public barrel at:

```text
apps/api/src/modules/<context>/index.ts
```

Cross-module and composition-root imports must use that barrel (or future domain events), for example:

```ts
import { IdentityAndAccessModule } from './modules/identity-and-access/index.js';
```

Forbidden:

```ts
// deep import of another context's internals
import { IdentityAndAccessDomainService } from './modules/identity-and-access/domain/...';
```

Public barrels currently export only intentionally shared surface:

- Nest module class
- application service token/class used for composition/tests
- public event names/types
- neutral skeleton DTO constants/types
- repository interface + DI token (no persistence adapter)

Internal folders remain private to the owning module.

## Boundary rules in force (PLAT-005)

Automated enforcement uses **dependency-cruiser** via `npm run boundaries:check` (also part of `npm run check`).

| Rule                                 | Meaning                                                                                |
| ------------------------------------ | -------------------------------------------------------------------------------------- |
| `no-cross-module-internal-imports`   | Module A may not import Module B internals; public barrel only                         |
| `composition-uses-public-module-api` | `app.module.ts`, `main.ts`, and `modules/index.ts` wire modules through public barrels |
| `no-common-depends-on-modules`       | Platform common layer cannot import bounded contexts                                   |
| `no-circular`                        | Circular dependency graphs are errors                                                  |

Additional product rules:

- No repository may query another module’s tables (none exist yet; still a design rule).
- Business routes remain blocked until the applicable API Contract Freeze.

## Local commands

From repository root:

```bash
npm install
npm run boundaries:check
npm run check
```

Start the skeleton API:

```bash
npm run start -w @educore/api
```

Default listen port is `3000` (override with `PORT`).

## Neutral endpoints

| Method | Path      | Meaning                                                      |
| ------ | --------- | ------------------------------------------------------------ |
| `GET`  | `/health` | Process liveness                                             |
| `GET`  | `/ready`  | Configuration readiness (no infrastructure dependencies yet) |

## Quality gate

`npm run check` must pass and includes format, lint, typecheck, tests (tooling + backend smoke + boundary validation), environment validation, and module-boundary enforcement.
