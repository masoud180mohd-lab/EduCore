# 37 Final Architecture Review

> **SOLO-GOV-002:** Historical freeze review. There was no separate architecture staff. Frozen decisions below remain the planning baseline; “Not Frozen Yet” items were later covered by slice DBF/ACF/DSF under Owner + AI.

## Review Verdict

Architecture is approved for freeze as a planning baseline.

This does not mean implementation details are frozen. It means the high-level architecture, domain boundaries, security posture, tenancy strategy, finance posture, offline strategy, AI governance, and operations principles are now stable enough to guide the next sprints.

## Review Summary

The original architecture had strong direction but too much scope and several under-specified risk areas. The v2.0 kit corrects the critical issues by making the following decisions explicit:

- MVP scope is narrowed.
- modular monolith is confirmed.
- shared PostgreSQL with RLS is confirmed as default tenancy.
- relationship-aware authorization is required.
- ledger is the source of truth.
- payment orchestration uses provider adapters.
- offline sync is operation-based.
- AI Gateway is mandatory.
- low-risk AI ships first.
- transactional outbox is required.
- workflow-level observability is required.
- privacy and audit are first-class concerns.

## Gap Review

| Gap | Risk | Resolution |
|---|---|---|
| SRS was distributed across many docs | AI agents could miss requirements | Added `34_SOFTWARE_REQUIREMENTS_SPECIFICATION.md` |
| Project architecture was distributed | AI agents could miss architecture baseline | Added `35_PROJECT_ARCHITECTURE.md` |
| MVP scope too broad | delivery delay and churn | MVP explicitly narrowed in SRS and requirements |
| Hybrid tenancy too complex | migration and ops risk | ADR-002 freezes shared PostgreSQL + RLS as default |
| RBAC alone insufficient | child data exposure | ADR-006 freezes relationship-aware authorization |
| Finance treated too lightly | payment disputes | ADR-004 freezes ledger as source of truth |
| Offline sync under-specified | data corruption | ADR-005 freezes operation-based sync |
| AI governance under-specified | privacy, cost, hallucination | ADR-003 and ADR-009 freeze AI Gateway and low-risk AI first |
| Event reliability not explicit enough | lost async work | ADR-008 freezes transactional outbox |
| Observability too technical | hidden business failures | ADR-010 freezes workflow-level observability |
| Payment provider complexity | reconciliation failures | ADR-011 freezes payment orchestration adapters |

## Frozen Architecture Decisions

The following are frozen:

1. EduCore starts as a modular monolith.
2. Bounded contexts in `35_PROJECT_ARCHITECTURE.md` are the official module boundaries.
3. Shared PostgreSQL with RLS is default tenancy.
4. Schema-per-tenant and database-per-tenant are not default tiers.
5. Finance ledger is the source of truth.
6. Payment provider integration goes through adapters.
7. Offline sync is operation-based.
8. Attendance is the first offline workflow.
9. AI Gateway is required for all AI features.
10. High-risk AI is deferred until evaluation and human review are ready.
11. Transactional outbox is required for critical domain events.
12. REST + BFF is the default API approach.
13. GraphQL requires a future ADR.
14. Workflow-level observability is required.
15. Support access is time-bound and audited.

## Not Frozen Yet

The following are not frozen:

- exact database tables.
- ERD.
- database migrations.
- API payloads.
- OpenAPI contracts.
- UI components.
- design tokens.
- provider-specific payment contracts.
- final infrastructure provider.

## Architecture Risks Still To Watch

These are accepted risks, not blockers:

- exact identity provider choice remains open.
- exact ORM choice remains open.
- exact payment provider for MVP remains open.
- exact cloud provider remains open.
- search engine is deferred.
- WhatsApp is deferred after SMS.
- Kubernetes is deferred.

## Recommendation

Proceed to Architecture Freeze, then Database Design Freeze.

Do not start production coding until:

- database schema and ERD are frozen.
- API contracts are frozen.
- design system baseline is frozen.

