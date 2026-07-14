# PLAT-003: Create Backend Module Skeleton

## Outcome

Create a NestJS modular-monolith skeleton in `apps/api` that registers all architecture-defined bounded contexts as non-business placeholders, exposes only neutral health endpoints, and integrates with the root quality baseline.

## Status

**Complete.** Acceptance criteria verified with a passing root `npm run check`, including Nest bootstrap smoke tests.

## Acceptance criteria

- `apps/api/` contains a NestJS skeleton that can bootstrap.
- Fourteen bounded-context modules exist with the required folder shape and placeholders.
- No business domain logic, schema, migrations, or public business APIs are introduced.
- Neutral health/readiness endpoints work.
- Unit smoke tests pass.
- Root `npm run check` passes.
- Task record and engineering guide are written.
- PLAT-004 and PLAT-005 are not started.
- Database, API Contract, and Design System freezes remain unviolated.

## Non-goals

- Database connection, ORM entities, migrations, RLS.
- Business routes for school workflows.
- Auth provider/session implementation.
- Docker, hosted CI, secret manager, cloud topology.
- Automated module-boundary import enforcement (`PLAT-005`).
- Frontend work (`PLAT-004`).

## Bounded context and affected modules

Platform Operations owns this foundation task. Affected area: `apps/api` workspace package, root TypeScript decorator enablement for NestJS, Vitest include paths, and engineering documentation.

## Governing documents and ADRs

- `EduCore/00_START_HERE.md`, `03_DEVELOPMENT_CONSTITUTION.md`, `08_BACKEND_GUIDELINES.md`, `11_TESTING_GUIDELINES.md`, `16_SECURITY_STANDARDS.md`, `18_CODING_STANDARDS.md`
- `EduCore/35_PROJECT_ARCHITECTURE.md`, `38_ARCHITECTURE_FREEZE_RECORD.md`, `39_ENGINEERING_EXECUTION_ROADMAP.md`, `40_MASTER_ENGINEERING_EXECUTION_PROMPT.md`, `44_DEFINITION_OF_READY.md`
- ADR-001 (modular monolith)

## Freeze-gate status

| Gate          | Status       | Impact                                   |
| ------------- | ------------ | ---------------------------------------- |
| Architecture  | Accepted     | NestJS modular monolith skeleton allowed |
| Database      | Not accepted | No schema/migrations/DB connection       |
| API Contract  | Not accepted | No business/public API contracts         |
| Design System | Not accepted | No UI work                               |

## Impact review

- Tenancy/RLS: no tenant data or RLS claims; repository placeholders only.
- Authorization: policy placeholders deny by default (`isAllowed(): false`).
- Privacy/security: logger redacts sensitive keys; error filter avoids stack/PII leakage; config is non-secret only.
- Observability: correlation ID middleware + structured log interface skeleton.
- Finance/payments/AI/offline: module shells only; no operational behaviour.
- Performance: no request-path business work; health checks are configuration-only.

## Implementation summary

- Added `@educore/api` workspace package with NestJS 11 dependencies.
- Implemented common platform modules: config, health, correlation, errors, logging, domain-event placeholder.
- Registered fourteen bounded-context skeleton modules with guideline-aligned structure.
- Added smoke tests for each module plus app bootstrap/health/correlation coverage.
- Documented skeleton layout and completion evidence.

## Verification evidence

```bash
npm run check
```

Expected: format, lint, typecheck, tests, and env:check succeed. Backend smoke suite proves module load, DI resolution, `/health`, `/ready`, and correlation-id propagation.

## Residual risks and deferrals

- Automated forbidden-import boundary checks remain `PLAT-005`.
- Design System Freeze still blocks `PLAT-004` frontend shell work when interpreted strictly by roadmap (frontend after design freeze).
- Hosted CI, Docker, secret management, and outbox implementation remain later approved Sprint 0 work.
