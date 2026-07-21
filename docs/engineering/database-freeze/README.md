# Database Freeze Records

This directory holds **downstream database design freeze** packages. These are engineering design records for the implementation repository. They do not replace the immutable EduCore kit (`EduCore/05_DATABASE_DESIGN.md`); they refine it for an approved slice.

## Authority

1. EduCore Development Constitution and accepted ADRs
2. Architecture Freeze v1.0
3. Accepted Database Freeze documents in this folder
4. Implementation PRs

## Records

| ID      | Slice                            | Document                                                               | Status                            |
| ------- | -------------------------------- | ---------------------------------------------------------------------- | --------------------------------- |
| DBF-001 | Identity & Tenant / Organization | [DBF-001-identity-tenant-slice.md](./DBF-001-identity-tenant-slice.md) | **Accepted v1.0 (solo-operator)** |
| DBF-010 | Guardians                        | [DBF-010-guardians-slice.md](./DBF-010-guardians-slice.md)             | Provisional (IMP-007)             |

## Rules

- A freeze is **not** a migration.
- Do not implement production schema for a slice until its freeze is accepted (DBF-001 Identity & Tenant is Accepted v1.0 under [SOLO-GOV-001](../governance/SOLO_OPERATOR_GOVERNANCE_NOTE.md)).
- Do not expand beyond the freeze table list without a revision or new freeze ID.
- Cross-module table access remains forbidden (ADR-001).
