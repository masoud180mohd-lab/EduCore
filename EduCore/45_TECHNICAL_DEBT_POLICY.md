# 45 Technical Debt Policy

## Purpose

Technical debt is an intentional or accidental compromise that increases future delivery, reliability, security, operational, or cost risk. It must be visible, owned, and managed; it must never become an undocumented shortcut.

## Rules

- No debt may bypass tenant isolation, authorization, privacy, audit, ledger integrity, offline correctness, AI governance, backup safety, or release controls.
- Every accepted debt item has an ID, owner role, reason, affected context, risk level, expiry/review date, repayment plan, and verification criterion.
- P0 debt is release-blocking. P1 debt requires an explicit time-bound exception. P2/P3 debt is planned through normal backlog governance.
- Architecture-changing debt requires an ADR. Security, finance, offline, and data debt requires specialist review.

## Debt Register Format

| Field | Required Content |
|---|---|
| ID | Stable identifier, for example `TD-001` |
| Context | Bounded context and affected module |
| Decision | What compromise exists and why |
| Risk | Security, correctness, reliability, cost, maintainability, or delivery impact |
| Priority | P0, P1, P2, or P3 |
| Owner | Accountable role |
| Expiry | Review or repayment date |
| Exit Evidence | Test, migration, ADR, or operational evidence proving closure |

## Review Cadence

Review debt before each release, at every architecture change, and monthly during active development. Link debt items to the risk register, release plan, and relevant ADR when applicable.