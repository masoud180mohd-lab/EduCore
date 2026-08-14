# 03 Development Constitution

This file defines how all AI agents and developers must work on EduCore.

## Who builds EduCore

**Project Owner + AI only.** Kit documents that name an Independent Board, separate architects, or countersigners (PM Master, Masoud Salum, Rashid Mohammed as distinct humans) are **retired as people-gates** ([SOLO-GOV-002](../docs/engineering/governance/SOLO-GOV-002-owner-plus-ai.md)). Human-signature blocks, countersignature emails, and video/meeting steps are **retired as gates kit-wide** ([SOLO-GOV-003](../docs/engineering/governance/SOLO-GOV-003-signature-video-gates-retired.md)) — the only human gate is Owner GO stated in session and recorded in the document. Do not wait for those people. Do not invent them. Technical rules below still bind.

## Prime Directive

Do not build random features. Build a trustworthy education operations platform.

When in doubt, optimize for:

1. Safety of child data.
2. Accuracy of financial records.
3. Tenant isolation.
4. Offline correctness.
5. Maintainability.
6. User speed and simplicity.
7. Cost control.

## Source Of Truth Order

1. This constitution.
2. Accepted ADR files in `decisions/`.
3. Architecture Freeze Record and Project Architecture (`38_ARCHITECTURE_FREEZE_RECORD.md`, then `35_PROJECT_ARCHITECTURE.md`).
4. Relevant domain-specific, security, privacy, and operations guidelines.
5. Consolidated SRS, product requirements, and implementation guidelines.
6. `04_SYSTEM_ARCHITECTURE.md` only as supplemental context.
7. Prompts and templates.

## Mandatory Architecture Rules

- Start as a modular monolith.
- Enforce module boundaries.
- Shared PostgreSQL with RLS is the default tenancy model.
- Do not implement schema-per-tenant unless an ADR approves it.
- Authorization must be policy-aware, not role-only.
- Finance must use immutable ledger concepts.
- Offline sync must be operation-based.
- AI calls must pass through AI Gateway.
- Sensitive actions must be audited.
- Critical async work must use transactional outbox.

## AI Agent Rules

Before coding, every AI agent must:

1. Read `00_START_HERE.md`, `43_PROJECT_STATUS.md`, and `42_ENGINEERING_READINESS_REVIEW.md`.
2. Read this constitution, relevant frozen documents, and the relevant domain guideline file.
3. Check accepted ADRs, the relevant freeze gates, and known limitations.
4. State assumptions, blockers, and scope boundaries.
5. Use `44_DEFINITION_OF_READY.md`, the Master Prompt, and the relevant AI-EOS prompt.
6. Keep changes scoped. Owner permission is enough; do not wait for a fictional Board.
AI agents must not:

- Add new technologies without justification.
- Bypass tenancy or RLS.
- Store secrets in code.
- Use AI directly from frontend.
- Call LLM providers outside AI Gateway.
- Generate fake financial balances.
- Treat audit logs as optional.
- Add offline support to a module without a sync policy.
- Add GraphQL without security and query governance.

## Definition Of Done

Every production feature must include:

- Unit tests.
- Integration tests where data is persisted.
- Permission tests.
- Tenant isolation tests.
- Error handling.
- Logging and tracing.
- Audit events for sensitive changes.
- Rate limit consideration.
- Documentation update.

For payment, ledger, sync, and authorization features, also include:

- Idempotency tests.
- Replay tests.
- Race condition tests.
- Recovery path.

## Security Rules

- Deny by default.
- Least privilege always.
- Use relationship-aware authorization.
- Support access must be time-bound and audited.
- MFA is required for platform admins and school finance admins.
- Never log secrets, raw tokens, or sensitive child data.
- Encrypt sensitive fields where needed.

## Data Rules

- Tenant-owned tables must include `tenant_id`.
- Tenant-owned data must have RLS.
- Money is stored as integer minor units.
- Financial corrections use reversal entries, not destructive edits.
- Soft delete is allowed only with retention rules.
- Audit data must be redacted where necessary.

## UX Rules

- Common workflows must be fast.
- Do not bury daily tasks in complex menus.
- Mobile-first for teachers and parents.
- Low-bandwidth mode matters.
- Offline state must be visible.
- Error messages must help users recover.

## AI Governance Rules

- AI output is advisory unless explicitly reviewed.
- No high-stakes automated decisions about children or teachers.
- Use evaluation datasets before releasing AI predictions.
- Track token cost per tenant.
- Redact PII where possible.
- Log prompts and responses with privacy controls.

## Release Rules

- Use feature flags for risky features.
- Use expand-contract migrations.
- No production release without rollback plan.
- No database migration without backup/restore confidence.
- No payment release without reconciliation tests.

