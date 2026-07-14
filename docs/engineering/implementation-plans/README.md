# Implementation Plans

Spec-driven implementation plans for approved product slices. Plans **do not** replace freezes; they sequence work after freezes are accepted.

## Authority

1. EduCore constitution + ADRs
2. Architecture Freeze v1.0
3. Accepted DBF / ACF for the slice
4. Implementation plan (this folder)
5. Code PRs

## Records

| ID      | Slice             | Document                                                                                           | Status                                             |
| ------- | ----------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| IMP-001 | Identity & Tenant | [IMP-001-identity-tenant-implementation-plan.md](./IMP-001-identity-tenant-implementation-plan.md) | Plan complete — coding gated on DBF/ACF acceptance |

## Rules

- No production domain coding before the plan’s gate checklist.
- Task IDs (e.g. `IMP-001-T10`) should appear in PR titles/descriptions.
- Prefer incremental PRs aligned to a single task or tight pair.
