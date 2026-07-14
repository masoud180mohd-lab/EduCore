# PR Checklist — Identity & Tenant Slice (IMP-001)

Copy into the PR description for any change under this slice.

## Spec links (required)

- [ ] DBF-001: `docs/engineering/database-freeze/DBF-001-identity-tenant-slice.md`
- [ ] ACF-001: `docs/engineering/api-contract-freeze/ACF-001-identity-tenant-slice.md`
- [ ] OpenAPI: `docs/engineering/api-contract-freeze/openapi/acf-001-identity-tenant.openapi.yaml`
- [ ] Task ID(s): `IMP-001-T__`

## Scope control

- [ ] No tables outside DBF-001 (unless freeze revision linked)
- [ ] No HTTP routes outside ACF-001 (unless freeze revision linked)
- [ ] No Student / Finance / Attendance / Payments domain work
- [ ] Cross-module access only via public barrels / interfaces (PLAT-005)

## Security

- [ ] Runtime DB role is **not** migrator/superuser
- [ ] No secrets, tokens, or password hashes in logs or responses
- [ ] Tenant isolation considered (header + membership + RLS when tables exist)
- [ ] Fail closed on missing auth / tenant / permission

## Quality

- [ ] `npm run check` passes locally
- [ ] New/changed behavior has tests or explicit risk acceptance
- [ ] Migrations (if any) have documented down/rollback notes
- [ ] Error responses use ACF-001 envelope (`code`, `message`, `requestId`)

## Reviewer focus

- [ ] Spec fidelity (OpenAPI / DBF)
- [ ] Security / tenancy
- [ ] Incremental size (prefer small PR)
