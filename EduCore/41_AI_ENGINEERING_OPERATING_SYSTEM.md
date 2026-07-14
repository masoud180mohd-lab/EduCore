# 41 AI Engineering Operating System

## Mission

The EduCore AI Engineering Operating System (AI-EOS) is the operating manual for any AI or human contributor from Sprint 0 through production operations.

It turns the AI Development Kit from a document library into an enforceable delivery workflow. The constitution and accepted ADRs remain higher authority than this document.

## Operating Model

Every task passes through five control loops:

1. Context: load governing documents, task intent, and bounded context.
2. Readiness: check freeze gates, dependencies, ownership, risks, and acceptance criteria.
3. Delivery: plan the smallest safe slice, implement within module boundaries, and document decisions.
4. Assurance: test, self-review, and validate security, tenancy, privacy, audit, and observability.
5. Release: verify rollout, support, monitoring, and rollback readiness.

No prompt may overrule the Development Constitution, an accepted ADR, or a frozen decision.

## Prompt Catalogue

| Stage | Prompt | Use |
|---|---|---|
| Universal | `40_MASTER_ENGINEERING_EXECUTION_PROMPT.md` | Mandatory wrapper for every implementation task |
| Intake | `prompts/ai_eos/01_task_intake_prompt.md` | Convert a request into a bounded, decision-ready task brief |
| Planning | `prompts/ai_eos/02_implementation_planning_prompt.md` | Identify work, sequencing, dependencies, and completion evidence |
| Domain | `prompts/ai_eos/03_domain_impact_prompt.md` | Check bounded context, ownership, invariants, and cross-module effects |
| Security | `prompts/ai_eos/04_security_privacy_prompt.md` | Threat, authorization, PII, and audit review |
| Data | `prompts/ai_eos/05_database_migration_prompt.md` | Design and review schema/migration work after database freeze |
| API | `prompts/ai_eos/06_api_contract_prompt.md` | Design/review contracts after API freeze |
| Backend | `prompts/ai_eos/07_backend_implementation_prompt.md` | Implement reviewed backend slices |
| Frontend | `prompts/ai_eos/08_frontend_implementation_prompt.md` | Implement reviewed UI slices after design freeze |
| Quality | `prompts/ai_eos/09_test_assurance_prompt.md` | Plan and review test evidence and failure paths |
| Review | `prompts/ai_eos/10_senior_code_review_prompt.md` | Mandatory pre-handoff implementation review |
| Release | `prompts/ai_eos/11_release_readiness_prompt.md` | Check progressive delivery, monitoring, and rollback |
| Operations | `prompts/ai_eos/12_incident_learning_prompt.md` | Handle incidents and turn learnings into controlled follow-up |

## Prompt Hierarchy

The mandatory execution order is:

1. `40_MASTER_ENGINEERING_EXECUTION_PROMPT.md`.
2. This AI-EOS operating model.
3. The relevant `prompts/ai_eos/` stage prompt.
4. A specialist prompt in `prompts/` only when it adds domain depth.

The older specialist prompts are supporting tools, not permission to bypass the Master Prompt, Definition of Ready, freeze gates, or readiness blockers.

## Mandatory Task Record

Each implementation task must include, in its ticket, pull request, or AI handoff:

- Business outcome and measurable acceptance criteria.
- Bounded context and modules affected.
- Source documents and ADRs consulted.
- Freeze gate status.
- Data, API, UI, and security impact.
- Test plan and results.
- Observability, rollout, rollback, and support notes.
- Explicit non-goals and residual risks.

Use `templates/IMPLEMENTATION_TASK_BRIEF_TEMPLATE.md`.

## Escalation Rules

| Situation | Required action |
|---|---|
| New material architecture choice | Propose ADR; do not implement the choice silently |
| Missing Database/API/Design freeze | Stop production slice; deliver a freeze-ready specification instead |
| Security/privacy uncertainty | Escalate to security owner with threat and data-flow evidence |
| Finance/payment inconsistency | Stop; reconcile against ledger and payment bibles before continuing |
| Tenant isolation uncertainty | Stop; define tenant context and RLS/authorization evidence |
| Offline conflict/replay ambiguity | Stop; define operation, idempotency, and recovery behavior |
| Failing quality gate | Fix within scope or document a release-blocking exception |

## AI-EOS Quality Bar

An implementation is ready for handoff only when it has an approved task brief, passed relevant tests, undergone self-review using the senior review prompt, and satisfied the Definition of Done in the Development Constitution.

## Sprint Sequence

1. Completed: architecture validation and Architecture Freeze v1.0.
2. Required next: Database, API Contract, and Design System freeze gates.
3. Sprint 0 Engineering Foundation: non-business foundation capabilities.
4. Sprint 1 onward: approved vertical feature slices, beginning with identity, organization, schools, and authorization.

Sprint numbering for implementation starts at the Engineering Foundation. The earlier `roadmap/sprint0_planning_validation.md` remains the completed architecture-validation record.