# EduCore AI Development Kit v2.0

This folder is the long-lived project constitution for EduCore, an education operations platform for Africa.

It is designed for:

- AI coding agents.
- human developers.
- architects.
- product managers.
- QA engineers.
- DevOps/SRE engineers.
- security reviewers.
- future CTO-level reviews.

Core rule: do not treat EduCore as a simple school management system. Treat it as the foundation for a trusted education operating platform.

## Canonical Kit Root

This directory (`EduCore/`) is the only kit root. A historical nested copy at `EduCore/EduCore/` was deleted on 2026-07-14 (Audit Remediation Phase 1 / G4). Always resolve kit paths relative to this folder, never a nested duplicate.

## Authority Order

If documents conflict, follow this order:

1. `03_DEVELOPMENT_CONSTITUTION.md`.
2. Accepted ADRs in `decisions/`.
3. `38_ARCHITECTURE_FREEZE_RECORD.md` and `35_PROJECT_ARCHITECTURE.md` for the frozen architecture baseline.
4. Relevant domain bibles and security/operations standards.
5. `34_SOFTWARE_REQUIREMENTS_SPECIFICATION.md`, product requirements, and implementation guidelines.
6. `04_SYSTEM_ARCHITECTURE.md` as supplemental context only; it cannot override frozen documents or ADRs.
7. AI-EOS prompts and templates.

## First Read For Any AI Agent

1. `00_START_HERE.md`
2. `VERSION.md`
3. `43_PROJECT_STATUS.md`
4. `42_ENGINEERING_READINESS_REVIEW.md`
5. `03_DEVELOPMENT_CONSTITUTION.md`
6. Accepted ADRs in `decisions/`
7. `38_ARCHITECTURE_FREEZE_RECORD.md`
8. `35_PROJECT_ARCHITECTURE.md`
9. `34_SOFTWARE_REQUIREMENTS_SPECIFICATION.md`
10. `44_DEFINITION_OF_READY.md`
11. `46_KNOWN_LIMITATIONS.md`
12. `39_ENGINEERING_EXECUTION_ROADMAP.md`
13. `40_MASTER_ENGINEERING_EXECUTION_PROMPT.md`
14. `41_AI_ENGINEERING_OPERATING_SYSTEM.md`
15. relevant domain, security, privacy, and operations documents
16. relevant prompt in `prompts/` and task template in `templates/`

## Core Documents

- `00_START_HERE.md`
- `00_PROJECT_BRIEF.md`
- `01_PRODUCT_VISION.md`
- `02_PRODUCT_REQUIREMENTS.md`
- `03_DEVELOPMENT_CONSTITUTION.md`
- `04_SYSTEM_ARCHITECTURE.md`
- `05_DATABASE_DESIGN.md`
- `06_API_SPECIFICATION.md`
- `07_DESIGN_SYSTEM.md`
- `08_BACKEND_GUIDELINES.md`
- `09_FRONTEND_GUIDELINES.md`
- `10_AI_GUIDELINES.md`
- `11_TESTING_GUIDELINES.md`
- `12_DEPLOYMENT_GUIDELINES.md`

## v2.0 Constitution Expansion

- `13_PROJECT_CHARTER.md`
- `14_BUSINESS_MODEL.md`
- `15_DOMAIN_MODEL_DDD.md`
- `16_SECURITY_STANDARDS.md`
- `17_PRIVACY_DATA_GOVERNANCE.md`
- `18_CODING_STANDARDS.md`
- `19_GIT_WORKFLOW.md`
- `20_PAYMENT_ACCOUNTING_BIBLE.md`
- `21_OFFLINE_SYNC_BIBLE.md`
- `22_OBSERVABILITY_BIBLE.md`
- `23_INCIDENT_RESPONSE_RUNBOOK.md`
- `24_RELEASE_MANAGEMENT.md`
- `25_RISK_REGISTER.md`
- `26_GLOSSARY.md`
- `27_INTEGRATION_STANDARDS.md`
- `28_SUPPORT_OPERATIONS.md`
- `29_COMPLIANCE_CHECKLIST.md`
- `30_PRODUCT_ANALYTICS_METRICS.md`
- `31_DATA_RETENTION_POLICY.md`
- `32_ACCESS_CONTROL_BIBLE.md`
- `33_SRE_RUNBOOKS.md`
- `34_SOFTWARE_REQUIREMENTS_SPECIFICATION.md`
- `35_PROJECT_ARCHITECTURE.md`
- `36_ARCHITECTURE_VALIDATION_SPRINT.md`
- `37_FINAL_ARCHITECTURE_REVIEW.md`
- `38_ARCHITECTURE_FREEZE_RECORD.md`
- `39_ENGINEERING_EXECUTION_ROADMAP.md`
- `40_MASTER_ENGINEERING_EXECUTION_PROMPT.md`
- `41_AI_ENGINEERING_OPERATING_SYSTEM.md`
- `42_ENGINEERING_READINESS_REVIEW.md`
- `43_PROJECT_STATUS.md`
- `44_DEFINITION_OF_READY.md`
- `45_TECHNICAL_DEBT_POLICY.md`
- `46_KNOWN_LIMITATIONS.md`
- `47_DOCUMENT_CONTROL_REGISTER.md`
- `48_AI_DEVELOPMENT_KIT_AUDIT_AND_ENHANCEMENT.md`
- `CHANGELOG.md`
- `DOCUMENT_MANIFEST.json`

## Supporting Folders

- `decisions/` contains Architecture Decision Records.
- `prompts/` contains task-specific prompts for AI agents, including the SDLC prompts in `prompts/ai_eos/`.
- `roadmap/` contains phased delivery plans.
- `templates/` contains reusable working templates.

## Non-Negotiable Architecture Decisions

- Modular monolith first.
- Shared PostgreSQL with RLS as default tenancy.
- Ledger is the finance source of truth.
- Operation-based offline sync.
- Relationship-aware authorization.
- REST + BFF before GraphQL.
- Transactional outbox for domain events.
- AI Gateway required for AI features.
- Low-risk AI first.
- Workflow-level observability.
- Payment orchestration through provider adapters.
- Architecture Freeze v1.0 is the baseline before database/API/design freeze.

## How To Use This Kit

For a new implementation task:

1. Read `00_START_HERE.md`, `43_PROJECT_STATUS.md`, `40_MASTER_ENGINEERING_EXECUTION_PROMPT.md`, `41_AI_ENGINEERING_OPERATING_SYSTEM.md`, and `42_ENGINEERING_READINESS_REVIEW.md`.
2. Read the constitution, requirement, relevant domain bible, and ADRs.
3. Create `templates/IMPLEMENTATION_TASK_BRIEF_TEMPLATE.md`.
4. Verify the relevant freeze gates and readiness-review blockers.
5. Use the matching AI-EOS prompt in `prompts/ai_eos/`.
6. Implement only after scope, authorization, data, tests, observability, release conditions, and blocker evidence are clear.

For project execution:

1. Completed: architecture validation and Architecture Freeze v1.0.
2. Complete Database, API Contract, and Design System freeze gates for the first slice.
3. Execute `roadmap/sprint0_engineering_foundation.md` for non-business foundations.
4. Close the mandatory blockers in `42_ENGINEERING_READINESS_REVIEW.md`.
5. Start approved Sprint 1 identity and organization feature slices only after the relevant gates are accepted.
6. Follow `39_ENGINEERING_EXECUTION_ROADMAP.md` for workstreams, dependencies, quality gates, and release sequence.