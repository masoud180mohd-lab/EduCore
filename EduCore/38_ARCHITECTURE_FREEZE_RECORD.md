# 38 Architecture Freeze Record

> **SOLO-GOV-002:** Frozen architecture direction still binds Owner + AI. This freeze was not signed by a separate architect staff.

## Freeze Name

EduCore Architecture Freeze v1.0

## Freeze Date

2026-07-12

## Freeze Status

Frozen for planning and downstream design.

## Meaning Of Freeze

This freeze locks the architecture direction. It does not lock the database schema, API contracts, UI components, or final infrastructure provider.

Any change to frozen decisions requires a new ADR.

## Frozen Documents

- `03_DEVELOPMENT_CONSTITUTION.md`
- `34_SOFTWARE_REQUIREMENTS_SPECIFICATION.md`
- `35_PROJECT_ARCHITECTURE.md`
- `36_ARCHITECTURE_VALIDATION_SPRINT.md`
- `37_FINAL_ARCHITECTURE_REVIEW.md`
- all accepted ADRs in `decisions/`

## Frozen Decisions

| Area | Decision |
|---|---|
| Product scope | MVP focuses on tenant, identity, student registry, academics, attendance, marks, fees, payments, receipts, SMS, parent portal |
| Architecture style | Modular monolith first |
| Bounded contexts | Use official bounded contexts from project architecture |
| Tenancy | Shared PostgreSQL with RLS by default |
| Enterprise isolation | Deferred; requires ADR |
| Authorization | RBAC + relationship-aware access + ABAC context + RLS |
| Finance | Ledger is source of truth |
| Payments | Payment orchestration with provider adapters |
| Offline | Operation-based sync |
| AI | AI Gateway required |
| AI rollout | Low-risk AI first |
| Events | Transactional outbox for critical events |
| API | REST + BFF first |
| GraphQL | Deferred; requires ADR |
| Observability | Workflow-level SLOs |
| Support | Time-bound audited support access |

## Change Control

Frozen architecture can only change through:

1. New ADR.
2. Risk assessment.
3. Update to affected kit documents.
4. Review of database/API/design impact.
5. Re-freeze record update.

## Next Freeze Gates

### Gate 1: Database Freeze

Requires:

- ERD.
- schema ownership by bounded context.
- RLS policies.
- indexing strategy.
- migration strategy.
- seed strategy.
- tenant isolation test plan.

### Gate 2: API Contract Freeze

Requires:

- OpenAPI baseline.
- endpoint list.
- request/response contracts.
- error contracts.
- idempotency rules.
- auth/permission rules.

### Gate 3: Design System Freeze

Requires:

- layout rules.
- design tokens.
- role navigation model.
- core components.
- offline states.
- accessibility baseline.

## Implementation Permission

Production coding is not approved by this freeze alone.

Coding may begin only after database, API, and design freeze gates are complete for the relevant slice.

