# 19 Git Workflow And Contribution Guide

## Branching

Use trunk-based development with short-lived branches.

Branch naming:

- `feature/<short-name>`
- `fix/<short-name>`
- `chore/<short-name>`
- `adr/<decision-name>`

## Commit Style

Use clear commits:

- `feat: add attendance sync operation model`
- `fix: prevent cross-tenant student query`
- `test: add payment webhook replay cases`
- `docs: add ledger ADR`

## Pull Request Requirements

Every PR must include:

- summary.
- risk level.
- tests run.
- migration notes.
- screenshots for UI.
- security/privacy notes if relevant.
- rollback plan for production-impacting changes.

## Required Reviewers

Require specialist review for:

- security changes.
- payment/ledger changes.
- auth/authorization changes.
- offline sync changes.
- AI changes.
- database migrations.

## Merge Rules

Do not merge if:

- tests fail.
- migrations are unsafe.
- secrets are present.
- tenant isolation is weakened.
- sensitive logging is introduced.

