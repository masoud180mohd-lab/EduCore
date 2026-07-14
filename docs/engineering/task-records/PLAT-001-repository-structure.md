# PLAT-001: Define Repository Structure

## Outcome

Establish a versioned, architecture-aligned repository topology that future Engineering Sprint 0 work can use without creating a business feature or silently selecting an implementation dependency.

## Acceptance criteria

- A repository map documents workspace boundaries and the intended application roots.
- The workspace roots are versioned and intentionally empty.
- The topology supports the approved modular-monolith direction and future Next.js web application without implementing either.
- No production data model, public business API, role-specific UI, provider selection, or other frozen-gate work is introduced.

## Non-goals

- Package manager, lint, formatting, type-checking, test, CI, Docker, framework, cloud, identity-provider, or secret-provider configuration.
- Backend/frontend source code, business packages, database schema or migrations, API contracts, and design tokens.
- CODEOWNERS, named reviewers, or branch protection configuration; the kit does not identify the organization-specific identities or Git hosting platform required for those controls.

## Bounded context and affected modules

Platform Operations owns this neutral foundation task. Affected repository areas are the root workspace map, documentation, versioned empty workspace roots, and the Git ignore policy. No product bounded context is implemented.

## Governing documents and ADRs read

- `EduCore/00_START_HERE.md`, `README.md`, `VERSION.md`, `43_PROJECT_STATUS.md`, `42_ENGINEERING_READINESS_REVIEW.md`, and `44_DEFINITION_OF_READY.md`
- `EduCore/03_DEVELOPMENT_CONSTITUTION.md`, `34_SOFTWARE_REQUIREMENTS_SPECIFICATION.md`, `35_PROJECT_ARCHITECTURE.md`, `38_ARCHITECTURE_FREEZE_RECORD.md`, `39_ENGINEERING_EXECUTION_ROADMAP.md`, `40_MASTER_ENGINEERING_EXECUTION_PROMPT.md`, `41_AI_ENGINEERING_OPERATING_SYSTEM.md`, and `46_KNOWN_LIMITATIONS.md`
- `EduCore/11_TESTING_GUIDELINES.md`, `16_SECURITY_STANDARDS.md`, `18_CODING_STANDARDS.md`, and `19_GIT_WORKFLOW.md`
- Accepted ADR-001 through ADR-011; ADR-001 is directly applicable.

## Freeze-gate status

| Gate          | Status       | Evidence                                                              |
| ------------- | ------------ | --------------------------------------------------------------------- |
| Architecture  | Accepted     | Architecture Freeze v1.0 (`EduCore/38_ARCHITECTURE_FREEZE_RECORD.md`) |
| Database      | Not accepted | No Database Freeze v1.0                                               |
| API Contract  | Not accepted | No API Contract Freeze v1.0                                           |
| Design System | Not accepted | No Design System Freeze v1.0                                          |

This is permitted because `PLAT-001` is explicitly scoped as controlled, non-business Engineering Sprint 0 work.

## Impact review

- Tenancy/RLS: no tenant data, persistence, or RLS policy is created.
- Authorization: no authorization implementation or access path is created.
- Privacy and audit: no personal data is processed. The ignore policy prevents common local secret artifacts from entering version control.
- Offline/sync, finance/payment, and AI: not applicable; no domain behavior is introduced.
- Observability: not applicable until the later observability foundation task.

## Implementation and verification plan

Create the Git repository, repository map, root documentation, neutral workspace roots, and conservative ignore policy. Verify the working tree, ignore behavior, documentation links, and absence of application/dependency configuration. The map is manually reviewed against ADR-001 and the Sprint 0 non-goals.

## Rollout, rollback, and support

The change is additive and contains no runtime behavior. Rollback is removal of the created structure and documentation in a future Git revert. No feature flag, migration, deployment, or support procedure applies.

## Assumptions and residual risks

- **Verified:** `PLAT-001` is the first approved Engineering Sprint 0 task in the roadmap's platform-foundation sequence.
- **Safe to proceed:** The documented `apps/api` and `apps/web` roots follow the frozen architecture's stated NestJS and Next.js directions without instantiating either framework.
- **Deferred by the kit:** organization-specific owner identities, Git host, branch protections, package manager, cloud topology, identity provider, database/API/design contracts, and all production features.
- **Residual risk:** documented boundaries are not yet automatically enforced; `PLAT-005` is the approved task that will add boundary checks.
