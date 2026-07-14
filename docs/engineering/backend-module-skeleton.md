# Backend Module Skeleton (PLAT-003 / PLAT-005)

## Status and scope

This document records the NestJS modular-monolith skeleton (`PLAT-003`) and enforceable module-boundary checks (`PLAT-005`).

**NestJS `src/` scope (skeleton):**

- No Nest persistence adapters or business HTTP routes
- No authentication provider / JWT session implementation
- No tenant provisioning application services

**Related platform work (outside the Nest skeleton document’s original PLAT-003 non-goals):**

- Local Docker Postgres/Redis: `DEV-001` (`docker-compose.yml`)
- SQL migrations + RLS under `apps/api/db/` (IMP-001 / AUDIT-R2) — see `apps/api/db/README.md`
- Hosted CI quality gate: `.github/workflows/quality-gate.yml` (AUDIT-R3)

## Location

- Workspace package: `apps/api` (`@educore/api`)
- Entry point: `apps/api/src/main.ts`
- Composition root: `apps/api/src/app.module.ts`
- Boundary rules: `.dependency-cruiser.cjs`
- Boundary runner: `scripts/check-module-boundaries.mjs`

## Platform common layer

| Area             | Path                           | Purpose                                                           |
| ---------------- | ------------------------------ | ----------------------------------------------------------------- |
| Config           | `src/common/config/`           | Typed non-secret config (`NODE_ENV`, `PORT`, `SERVICE_NAME`)      |
| Health           | `src/common/health/`           | Neutral `/health` and `/ready` endpoints                          |
| Correlation      | `src/common/correlation/`      | `X-Correlation-Id` + `X-Request-Id` middleware (ACF-001)          |
| Errors           | `src/common/errors/`           | `AppError` + ACF envelope (`requestId`) + global filter           |
| Auth plumbing    | `src/common/auth/`             | Bearer extract, `TokenValidator`, auth context middleware, guards |
| Tenant context   | `src/common/tenant/`           | `X-Tenant-Id` parse, membership checker interface                 |
| Policy           | `src/common/policy/`           | Permission codes + `PolicyEvaluator` foundation                   |
| Idempotency      | `src/common/idempotency/`      | Key validation + scope key + in-memory store helpers              |
| Pagination       | `src/common/pagination/`       | Cursor list helpers (`limit`/`cursor`)                            |
| Request platform | `src/common/request-platform/` | Global DI defaults (fail-closed token/membership/permissions)     |
| Logging          | `src/common/logging/`          | Structured logger interface with field redaction                  |
| Events           | `src/common/events/`           | Domain-event type and no-op publisher placeholder                 |

**Audit publisher** lives in **platform-operations** (`AUDIT_PUBLISHER` via public barrel) — not in common — so other modules depend on the bounded-context contract (IMP-001-T19 / ADR-001).

Modules may depend on `src/common/**`. The common layer must not depend on any bounded-context module.

## Bounded-context modules

Each context follows `EduCore/08_BACKEND_GUIDELINES.md` folder shape:

- module definition
- controllers (placeholder, no business routes)
- application services (placeholder)
- domain services (placeholder)
- repositories (interface + non-persistent placeholder — **private to the module**)
- DTOs (neutral skeleton only)
- policies (deny-by-default placeholder)
- events (event-name placeholders)
- smoke tests
- **public API barrel** (`index.ts`) — the only cross-module import surface

Registered contexts (ADR-001 / architecture map): Identity And Access, Tenant And Billing, Student Registry, Academic Structure, Attendance, Assessment, Finance Ledger, Payments, Communication, Documents And Files, AI Insights, Integrations, Analytics, Platform Operations.

## Public API convention

Each bounded context exposes a public barrel at:

```text
apps/api/src/modules/<context>/index.ts
```

Public barrels export only:

- Nest module class
- application service class used for composition/tests
- public event names/types
- neutral skeleton DTO constants/types

**Not exported (AUDIT-R3):** repository interfaces and DI tokens. Persistence stays intra-module to prevent legal cross-module repository coupling via barrels.

Forbidden:

```ts
// deep import of another context's internals
import { IdentityAndAccessDomainService } from './modules/identity-and-access/domain/...';
```

## Boundary rules in force (PLAT-005)

Automated enforcement uses **dependency-cruiser** via `npm run boundaries:check` (also part of `npm run check`).

| Rule                                 | Meaning                                                                                |
| ------------------------------------ | -------------------------------------------------------------------------------------- |
| `no-cross-module-internal-imports`   | Module A may not import Module B internals; public barrel only                         |
| `composition-uses-public-module-api` | `app.module.ts`, `main.ts`, and `modules/index.ts` wire modules through public barrels |
| `no-common-depends-on-modules`       | Platform common layer cannot import bounded contexts                                   |
| `no-circular`                        | Circular dependency graphs are errors                                                  |

Additional product rules:

- No repository may query another module’s tables.
- Business routes remain blocked until the applicable API Contract Freeze and conditional freeze conditions are met.

## Local commands

```bash
npm install
npm run boundaries:check
npm run check
npm run start -w @educore/api
```

## Neutral endpoints

| Method | Path      | Meaning                                                      |
| ------ | --------- | ------------------------------------------------------------ |
| `GET`  | `/health` | Process liveness                                             |
| `GET`  | `/ready`  | Configuration readiness (no infrastructure dependencies yet) |

## Quality gate

`npm run check` must pass (format, lint, typecheck, tests, env, boundaries). Hosted CI runs the same command via `.github/workflows/quality-gate.yml`.
