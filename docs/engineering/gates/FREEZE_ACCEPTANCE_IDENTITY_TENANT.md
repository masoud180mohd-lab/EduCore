# Freeze Acceptance Record — Identity & Tenant Slice

## Document ID

`FREEZE-ACC-001` — Identity & Tenant (DBF-001 + ACF-001)

## Date

2026-07-14

## Status

**CONDITIONAL ACCEPTANCE** (Audit Remediation Phase 1 / G2)

This record does **not** grant unrestricted production coding permission. It records an honest governance state after Independent Engineering Audit findings of 2026-07-14.

## Related freeze artifacts

| Artifact                  | Path                                                                                | Prior status                          |
| ------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------- |
| Database Freeze draft     | `docs/engineering/database-freeze/DBF-001-identity-tenant-slice.md`                 | Proposed; human signature block empty |
| API Contract Freeze draft | `docs/engineering/api-contract-freeze/ACF-001-identity-tenant-slice.md`             | Proposed; human signature block empty |
| OpenAPI baseline          | `docs/engineering/api-contract-freeze/openapi/acf-001-identity-tenant.openapi.yaml` | Draft baseline                        |

## What already exists in the repository (fact)

As of this record, the workspace already contains:

- Migration tooling and ordered SQL under `apps/api/db/migrations/` including catalogs, RLS helpers, `tenants`, `users`, and FORCE RLS policies.
- Design artifacts that largely cover Gate 1 / Gate 2 _content_ requirements from Architecture Freeze Gate 1 and Gate 2.

This implementation **preceded** formal human signatures. Gate documents previously recorded “MASTER PROMPT / prompt authorization” which is **not** independent human review and is **not** valid freeze acceptance under EduCore governance.

## Conditional decision

| Decision                                                                         | Value                                                       |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Unrestricted Identity/Tenant API & domain coding                                 | **NO GO**                                                   |
| Keep existing P1 SQL as provisional scaffolding pending Phase 2 security closure | **CONDITIONAL GO**                                          |
| Add further tenant-owned tables beyond current migrations                        | **NO GO** until Phase 2 RLS + live T1–T8 isolation evidence |
| Treat DBF-001 / ACF-001 as “Accepted Freeze v1.0” without human signatures       | **NO**                                                      |

## Mandatory conditions (must close before full freeze acceptance)

1. **Human signatures** on DBF-001 and ACF-001 approval blocks (Database Architect, Principal Architect, Security, Backend Lead / API Contract Guardian).
   - **Exception path (now recorded):** [`ADR-012`](../decisions/ADR-012-exception-identity-tenant-implementation.md) authorizes **limited provisional** Identity/Tenant persistence work under Conditional Freeze; it **does not** mark freezes as full v1.0 accepted.
2. **G3 — RLS trust model:** prevent client-settable GUC spoofing on INSERT/bootstrap/platform paths (Audit Critical G3). **Status: addressed in AUDIT-R2** (re-verify on review).
3. **G3 — Live isolation evidence:** automated PostgreSQL integration tests using `educore_app`. **Status: evidenced PASS** (see AUDIT-R2 live evidence; re-run on schema change).
4. **Membership path:** replace fail-closed membership stub with real membership-backed visibility. **Status: `tenant_memberships` + SECURITY DEFINER helpers landed** (IMP-001 P1 continuation); keep expanding isolation coverage.
5. **OpenAPI hardening:** encode permission requirements / auth schemes before NestJS identity/tenant **route** implementation. **Status: securitySchemes + x-permissions landed**; full freeze signature still open.

## Allowed work under this conditional record

- Audit Remediation Phase 2 (RLS hardening + live isolation tests).
- Documentation reconciliation (Phase 3).
- Structural hardening (public barrel repository token policy, CI baseline) without new business features.
- Non-destructive review of existing provisional migrations.

## Forbidden work under this conditional record

- New business domain features (students, fees, attendance, finance ledger posting, payments, AI providers, etc.).
- Additional business schema tables beyond the provisional Identity/Tenant P1 set already present.
- Claiming “Database Freeze accepted” or “API Contract Freeze accepted” without closing the conditions above.
- Self-approving further gates via AI prompt names alone.

## Supersedes

- Self-declared GO language in prompt-authorization gate notes that treated incomplete freezes as full authorization for tenant-owned tables.

Does **not** supersede Architecture Freeze v1.0 (`EduCore/38_ARCHITECTURE_FREEZE_RECORD.md`).

## Residual risks (updated after ADR-012 + memberships + OpenAPI hardening)

- **Exception ADR-012** is **time-bounded** (review by 2026-08-15; hard expiry 2026-09-15 unless renewed or freezes fully accepted). Do not treat it as permanent permission to skip freezes.
- **Domain NestJS routes** remain **NO GO** under ADR-012 until full freeze acceptance or a new ADR.
- Live isolation evidenced; re-run suite after each schema change (`RUN_LIVE_DB_TESTS=1`).
- Full DBF/ACF **human signatures** remain open — freezes are still not “Accepted v1.0”.
- Physical Drive-sync workspace relocation remains an operator action (Audit G1 residual).

## Sign-off

### Conditional record authors (process remediation)

| Role                            | Name                                  | Date       | Notes                                                             |
| ------------------------------- | ------------------------------------- | ---------- | ----------------------------------------------------------------- |
| Audit Remediation (Engineering) | Cursor Agent session — Phase 1 prompt | 2026-07-14 | Creates conditional governance only; not a human freeze signature |
| Product Owner / Project Lead    | _pending human_                       |            | Must acknowledge this CONDITIONAL status                          |

### Full freeze still requires (unchanged)

| Role                  | DBF-001 | ACF-001 |
| --------------------- | ------- | ------- |
| Database Architect    | pending | n/a     |
| Principal Architect   | pending | pending |
| Security              | pending | pending |
| Backend Lead          | pending | pending |
| API Contract Guardian | n/a     | pending |

## Revision history

| Version | Date       | Notes                                                      |
| ------- | ---------- | ---------------------------------------------------------- |
| 1.0     | 2026-07-14 | Conditional acceptance after Independent Engineering Audit |
