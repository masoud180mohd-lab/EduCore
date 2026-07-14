# API Contract Freeze Records

Engineering design freezes for public HTTP contracts. These refine `EduCore/06_API_SPECIFICATION.md` for a concrete slice and do **not** replace the immutable kit.

## Authority order

1. Development Constitution + accepted ADRs
2. Architecture Freeze v1.0
3. Accepted Database Freeze for the same slice (e.g. DBF-001)
4. Accepted API Contract Freeze documents here
5. Implementation PRs

## Records

| ID      | Slice             | Document                                                               | OpenAPI                                                                                        | Status                  |
| ------- | ----------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------- |
| ACF-001 | Identity & Tenant | [ACF-001-identity-tenant-slice.md](./ACF-001-identity-tenant-slice.md) | [openapi/acf-001-identity-tenant.openapi.yaml](./openapi/acf-001-identity-tenant.openapi.yaml) | Proposed for acceptance |

## Rules

- Freeze ≠ implementation (no controllers required to “complete” the freeze).
- Breaking changes need a new version or superseding freeze revision.
- Cross-tenant leakage is a release blocker; contracts must fail closed.
