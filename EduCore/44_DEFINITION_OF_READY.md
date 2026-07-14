# 44 Definition Of Ready

## Purpose

A task is ready for implementation only when it has enough approved information for a competent engineer or AI to work without inventing requirements.

## Mandatory Inputs

Every task brief must state:

- Business outcome, measurable acceptance criteria, and explicit non-goals.
- Bounded context, owner, affected modules, and relevant source documents/ADRs.
- Current freeze-gate status.
- Data classification, tenant, authorization, privacy, audit, and observability impact.
- Finance, payment, offline, AI, and integration impact when applicable.
- Dependencies, feature-flag/rollout expectations, migration effect, and rollback/recovery expectation.
- Test strategy and completion evidence.
- Known assumptions, unresolved decisions, and residual risks.

Use `templates/IMPLEMENTATION_TASK_BRIEF_TEMPLATE.md`.

## Gate Rules

| Work Type | Minimum Ready Condition |
|---|---|
| Engineering Sprint 0 foundation | In `roadmap/sprint0_engineering_foundation.md`; no business feature, schema, or public business contract; scope and ownership clear |
| Production persistence | Relevant Database Freeze accepted |
| Production API/client integration | Relevant API Contract Freeze accepted |
| Role-specific production UI | Relevant Design System Freeze accepted |
| Identity/authorization | Threat model and identity/session decision accepted; policy and audit requirements defined |
| Finance/payments | Ledger/payment invariants, provider contract, idempotency, reconciliation, and recovery tests defined |
| Offline workflow | Operation model, conflict rules, permission recheck, user states, and recovery behavior defined |
| AI workflow | Gateway, privacy, evaluation, budget, human-review, fallback, and release gate defined |

## Not Ready Conditions

A task is not ready when a required contract, ownership boundary, policy, acceptance criterion, test approach, rollout path, or blocker decision is unknown. The correct output is a decision-ready plan, not implementation.

## Ready Approval

The task owner records readiness in the task brief. Security, data, design, finance, or SRE reviewers must approve tasks in their required review domain. The Master Engineering Execution Prompt remains mandatory even after a task is ready.