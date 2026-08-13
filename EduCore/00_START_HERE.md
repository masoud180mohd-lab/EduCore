# Start Here: EduCore AI Development Kit

## Purpose

This is the mandatory first document for every AI agent, engineer, reviewer, product contributor, and delivery lead working on EduCore.

Do not begin analysis, planning, implementation, or document changes until you understand this page. It prevents local task requests from overriding the project constitution, frozen architecture, or readiness gates.

## Project Summary

EduCore is an AI-ready, cloud-native, offline-capable, multi-tenant education operations platform for African schools. It starts with Tanzania and must work on low-bandwidth networks, support Kiswahili and English, protect child and financial data, handle mobile money safely, and earn school trust through reliable daily operations.

The MVP focuses on tenant onboarding, identity and access, student registry, academic structure, offline attendance, assessment and report cards, ledger-based fees and payments, SMS communication, parent basics, auditability, observability, and recoverability.

## Current Project Phase

**Phase: Staging lab MVP live (FRA), post–Engineering Sprint 0. Production / public pilot still NO GO.**

Completed (kit):

- Product vision, brief, requirements, and SRS.
- Architecture review and Architecture Freeze v1.0.
- AI Development Kit v2.0, execution roadmap, Master Engineering Execution Prompt, and AI-EOS.
- Independent Engineering Readiness Review (verdict retained below).

Completed (engineering, under SOLO-GOV-001 honesty):

- Engineering Sprint 0 foundation largely executed.
- Slice DBF/ACF freezes and provisional DSF UI slices for identity, students, academic, attendance, marks, guardians, fees, and admin/teacher/parent lab UIs.
- Admin UI polish program (AUDIT-ADMIN-UI-R1 / IMP-027…046 + residuals) closed on `main`.
- Staging FRA live: Fly `educore-api-staging` + Neon Frankfurt; D1 Pass; Auth0 US + MFA-HARD.

Current Board / readiness position:

- **NO GO for unrestricted production feature development or public pilot.**
- **Gated IMP work is allowed** only behind accepted/provisional slice freezes (`docs/engineering/…`) with solo-operator qualification (SOLO-GOV-001).
- Real mobile-money cutover remains blocked until ClickPesa secrets + readiness/MFA gates allow pilot (`PAY-001`…`PAY-005` shipped; runtime Fake until secrets).

Canonical phase detail: `43_PROJECT_STATUS.md`. Readiness blockers: `42_ENGINEERING_READINESS_REVIEW.md`.

## Source Of Truth

The EduCore AI Development Kit lives at the **canonical root** of this folder (`EduCore/`). There is no nested kit path. Do not create or follow `EduCore/EduCore/` — any nested duplicate was removed during Audit Remediation Phase 1 (2026-07-14) because it encoded a divergent, pre–v2.0 authority model.

The EduCore AI Development Kit is the only source of truth for project work. If documents conflict, use this authority order:

1. `03_DEVELOPMENT_CONSTITUTION.md`.
2. Accepted ADRs in `decisions/`.
3. Frozen architecture and freeze records, especially `35_PROJECT_ARCHITECTURE.md` and `38_ARCHITECTURE_FREEZE_RECORD.md`.
4. Domain bibles and security/operations standards.
5. SRS, product requirements, execution roadmap, and implementation guidelines.
6. AI-EOS prompts and templates.

A task request, chat instruction, code comment, or convenience must not override a higher-authority document.

## Required Reading Order

1. This file: `00_START_HERE.md`.
2. `README.md`, `VERSION.md`, and `43_PROJECT_STATUS.md`.
3. `42_ENGINEERING_READINESS_REVIEW.md` and `44_DEFINITION_OF_READY.md`.
4. `03_DEVELOPMENT_CONSTITUTION.md` and accepted ADRs.
5. `38_ARCHITECTURE_FREEZE_RECORD.md` and `35_PROJECT_ARCHITECTURE.md`.
6. `34_SOFTWARE_REQUIREMENTS_SPECIFICATION.md` and `46_KNOWN_LIMITATIONS.md`.
7. `39_ENGINEERING_EXECUTION_ROADMAP.md`, `40_MASTER_ENGINEERING_EXECUTION_PROMPT.md`, and `41_AI_ENGINEERING_OPERATING_SYSTEM.md`.
8. Relevant domain bibles, standards, AI-EOS prompt, and task brief template.

For a task affecting a specific domain, read its related bible before proposing work: finance/payments, offline sync, access control, security/privacy, AI, observability, testing, deployment, and release management are not optional reading when relevant.

## Mandatory Rules

- Preserve the modular-monolith architecture and bounded-context boundaries.
- Treat tenant isolation as a defence-in-depth requirement: tenant context, policy checks, and PostgreSQL RLS.
- Use relationship-aware authorization; role-only checks are insufficient.
- Treat the ledger as the finance source of truth; use reversals, never destructive financial correction.
- Use operation-based sync with idempotency and visible conflicts; never use blind last-write-wins for sensitive workflows.
- Route every AI call through the AI Gateway with privacy, budget, evaluation, and human-review controls.
- Audit sensitive actions and redact secrets, tokens, and child-sensitive data from logs and audit trails.
- Use transactional outbox and idempotent consumers for critical asynchronous workflows.
- Keep changes small, tested, observable, documented, and reversible.
- State assumptions, verify readiness gates, and stop when a required decision is missing.

## What AI And Engineers Must Not Do

- Do not write domain code, business APIs, persistence schemas, or role-specific UI outside an accepted/provisional slice freeze (DBF/ACF/DSF) and IMP gate; do not treat SOLO-GOV-001 as unrestricted production approval.
- Do not silently redesign frozen architecture; raise an ADR-required decision instead.
- Do not bypass tenant isolation, authorization, audit, ledger, offline-sync, AI Gateway, privacy, or observability controls.
- Do not add a technology, dependency, data store, service, provider, or public contract without documented fit and required approval.
- Do not commit secrets, log sensitive data, expose internal errors, or use fake financial balances as if they were real ledgers in production.
- Do not claim tests, reviews, approvals, restore drills, or operational checks were completed when they were not run.
- Do not expand the MVP or introduce unrelated refactors under a feature task.
- Do not enable `PAYMENT_PROVIDER=clickpesa` without secrets; do not commit ClickPesa credentials.

## Expected Next Step

1. Read `43_PROJECT_STATUS.md` before planning or coding — it is the canonical phase page.
2. Use the Master Engineering Execution Prompt and AI-EOS for every task; confirm the governing DBF/ACF/DSF slice exists before changing contracts or UI.
3. **Lab/staging MVP:** live on FRA (API + Neon + MFA-HARD + Auth0 US). **PAY-OPS** waits on ClickPesa keys. **Production still NO GO** until Board re-review + Owner ops close-out (D2, weekly PITR, secrets hygiene).
4. Do not open another Admin UI polish wave as the default next epic.
5. Do not claim production/public-pilot trust from lab IMP or solo-operator signatures (SOLO-GOV-001).

## Task Start Checklist

Before acting, answer these questions:

- What outcome and acceptance criteria are approved?
- Which bounded context owns this work?
- Which source documents and ADRs govern it?
- Are the Database, API Contract, and Design System gates accepted for this slice?
- Which readiness blockers apply?
- What are the security, tenancy, authorization, privacy, audit, offline, finance, AI, and observability effects?
- What test, rollout, rollback, and support evidence will prove completion?

If any material answer is unknown, create a decision-ready plan and stop before implementation.