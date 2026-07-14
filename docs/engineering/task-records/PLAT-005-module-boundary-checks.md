# PLAT-005: Add Enforceable Module-Boundary Checks

## Outcome

Automate ADR-001 modular-monolith boundary enforcement so bounded contexts cannot silently import one another’s internals. Cross-module use is limited to public barrels (and future domain events).

## Status

**Complete.** Root `npm run check` includes `boundaries:check`, and validation tests prove forbidden deep imports fail while public-barrel imports pass.

## Acceptance criteria

- Boundary enforcement tool is installed and configured.
- Forbidden cross-module internal imports fail the check.
- Allowed imports (public barrels + common platform) succeed.
- `npm run boundaries:check` exists and is part of `npm run check`.
- Validation tests prove enforcement behaviour.
- Root `npm run check` passes.
- Task record and engineering docs are updated.
- PLAT-004 is not started.
- Freeze gates remain respected.

## Non-goals

- Business logic, schema, migrations, auth, RLS, outbox implementation.
- Frontend shell (PLAT-004).
- Docker, hosted CI, secret managers, cloud topology.
- Changes to immutable `EduCore/` kit documents.

## Tool choice

**dependency-cruiser** was selected over ESLint-only boundary plugins because:

- it models monorepo/module graphs with explicit allow/deny path rules
- it supports composition-root rules and circular dependency detection
- it is fast, local-only, and CI-ready without hosted services
- it fits DDD modular monoliths where public barrels are the primary import surface

Pinned version: `dependency-cruiser@18.1.0` (exact lockfile).

## Governing documents

- ADR-001 (modular monolith)
- `EduCore/08_BACKEND_GUIDELINES.md` (module communication)
- `EduCore/35_PROJECT_ARCHITECTURE.md` (bounded contexts)
- `docs/engineering/backend-module-skeleton.md`

## Freeze-gate status

| Gate          | Status       | Impact                       |
| ------------- | ------------ | ---------------------------- |
| Architecture  | Accepted     | Boundary enforcement allowed |
| Database      | Not accepted | No schema impact             |
| API Contract  | Not accepted | No business API impact       |
| Design System | Not accepted | No UI impact                 |

## Implementation summary

- Added `.dependency-cruiser.cjs` rules for cross-module internals, composition public API use, common→module isolation, and cycles.
- Added `scripts/check-module-boundaries.mjs` and `npm run boundaries:check`.
- Wired boundary check into root `npm run check`.
- Created public `index.ts` barrels for all 14 bounded contexts.
- Updated composition roots to import barrels only.
- Added Vitest suite proving pass/fail enforcement behaviour.
- Updated engineering docs and workspace standards tests.

## Verification evidence

```bash
npm run boundaries:check
npm run check
```

Expected:

- current skeleton has zero dependency violations
- probe with deep cross-module import fails
- probe with public-barrel import passes
- full quality gate passes

## Residual risks and deferrals

- Public barrel surface will grow carefully as feature slices are approved; keep exports minimal.
- Domain-event bus / outbox is still a placeholder; event-only coupling is not fully modelled yet.
- Hosted CI still deferred; local `npm run check` is the enforceable gate today.
