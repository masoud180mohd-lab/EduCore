# PLAT-002: Configure Lint, Type, And Test Baseline

## Outcome

Provide a reproducible, locally executable quality baseline for the Engineering Sprint 0 workspace: exact-lockfile tooling, strict TypeScript, type-aware linting, formatting, a neutral test harness, and safe local environment validation.

## Status

**Complete.** Acceptance criteria verified with a passing `npm run check` on a clean dependency install.

## Acceptance criteria

- `npm run format:check`, `npm run lint`, `npm run typecheck`, and `npm run test` run successfully from the repository root.
- `npm run check` combines the required quality gates without relying on a hosted CI provider.
- TypeScript strict mode and additional safety checks are enforced.
- The test harness proves neutral tooling behavior without creating a business feature.
- A local environment example and validator fail safely without printing sensitive values.
- Exact tool versions are captured in `package-lock.json`.

## Non-goals

- Backend or frontend application skeletons, module boundaries, production API routes, database schema/migrations, design system, Docker, cloud topology, hosted CI, or provider selection.
- Production configuration, secrets, database URLs, tenant data, identity configuration, feature flags, or observability implementation.
- Domain-specific test suites; those remain tied to their approved bounded-context work.

## Bounded context and affected modules

Platform Operations owns this neutral foundation task. It affects root tooling, documentation, scripts, and `tests/tooling`; no product bounded context is implemented.

## Governing documents and ADRs

- `EduCore/03_DEVELOPMENT_CONSTITUTION.md`, `18_CODING_STANDARDS.md`, `11_TESTING_GUIDELINES.md`, `16_SECURITY_STANDARDS.md`, and `19_GIT_WORKFLOW.md`
- `EduCore/35_PROJECT_ARCHITECTURE.md`, `38_ARCHITECTURE_FREEZE_RECORD.md`, `39_ENGINEERING_EXECUTION_ROADMAP.md`, `42_ENGINEERING_READINESS_REVIEW.md`, `44_DEFINITION_OF_READY.md`, and `46_KNOWN_LIMITATIONS.md`
- ADR-001 is directly applicable: the tooling supports the future modular monolith without creating it.

## Freeze-gate status

Architecture Freeze is accepted. Database, API Contract, and Design System freezes remain unaccepted and are not needed for this neutral Sprint 0 tooling task. The task creates neither persistence, public contracts, nor production UI.

## Impact review

- Tenancy/RLS, authorization, audit, privacy data, offline, finance, payments, AI, and runtime observability: no production path or domain behavior is introduced.
- Secrets: `.env` and common key/certificate files remain ignored; the validator limits output to a validated environment label and does not echo invalid input.
- Supply chain: npm lockfile pins resolved tooling; `npm audit` remains enabled.
- Performance: commands run only in development/CI; no production runtime impact.

## Implementation summary

- Root npm workspace with exact-version tooling and lockfile.
- Strict TypeScript project covering scripts and tests only.
- Flat ESLint config with type-aware TypeScript rules scoped to `.ts` sources.
- Prettier, EditorConfig, and LF Git attributes.
- Vitest Node test foundation with neutral workspace and environment suites.
- Safe `NODE_ENV` validator and `.env.example`.
- Development environment documentation and quality-gate contract.

## Verification evidence

Run from repository root after `npm install`:

```bash
npm run check
```

Expected: format, lint, typecheck, test, and env:check all succeed. `npm audit` reports zero known vulnerabilities for the tooling set.

## Rollout and rollback

There is no deployment or migration. Teams adopt `npm run check` locally now; a later infrastructure task can run the same command in hosted CI. Revert this change to roll back the tooling baseline.

## Residual risks and deferrals

- Hosted CI, dependency/SAST automation, branch protection, Docker, and secret-manager selection remain later approved work; no provider was selected.
- Automated module boundary checks remain `PLAT-005`.
- Domain-risk suites remain deferred until their required contracts and bounded-context work are approved.
