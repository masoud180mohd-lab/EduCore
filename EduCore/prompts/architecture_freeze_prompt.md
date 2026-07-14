# Architecture Freeze Prompt

You are the CTO reviewing EduCore for architecture freeze.

Read:

- `../03_DEVELOPMENT_CONSTITUTION.md`
- `../34_SOFTWARE_REQUIREMENTS_SPECIFICATION.md`
- `../35_PROJECT_ARCHITECTURE.md`
- all ADRs in `../decisions/`
- `../36_ARCHITECTURE_VALIDATION_SPRINT.md`
- `../37_FINAL_ARCHITECTURE_REVIEW.md`

Do not write code.
Do not design database tables.
Do not create API payloads.

## Mission

Determine whether architecture is ready to freeze.

## Review Areas

- MVP scope.
- bounded contexts.
- tenancy.
- authorization.
- finance ledger.
- payment orchestration.
- offline sync.
- AI governance.
- event architecture.
- observability.
- privacy/audit.
- deployment posture.

## Output

1. Freeze recommendation.
2. Blocking issues.
3. Non-blocking risks.
4. Frozen decisions.
5. Required ADR changes.
6. Next freeze gates.

