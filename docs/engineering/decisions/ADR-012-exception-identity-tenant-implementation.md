# ADR-012: Exception — Proceed with Identity & Tenant Implementation under Conditional Freeze

## Status

**Accepted** (time-bounded architecture exception)

| Field              | Value                                                                                                       |
| ------------------ | ----------------------------------------------------------------------------------------------------------- |
| ADR ID             | `ADR-012`                                                                                                   |
| Type               | **Governance / process exception** (not a product architecture redesign)                                    |
| Date accepted      | 2026-07-15                                                                                                  |
| Supersedes         | Prompt-only “GO” language that implied full freeze acceptance without human review                          |
| Does not supersede | Architecture Freeze v1.0 (`EduCore/38_ARCHITECTURE_FREEZE_RECORD.md`), ADR-001–ADR-011 in the immutable kit |
| Location           | Repository engineering decision — `docs/engineering/decisions/` (outside immutable `EduCore/decisions/`)    |
| Expiry             | See **Review & Expiry** below                                                                               |

---

## Title (short form)

**Exception: Authorize limited Identity & Tenant persistence and contract scaffolding under Conditional Freeze, without treating DBF-001 / ACF-001 as fully accepted Freeze v1.0.**

---

## Context

### Project governance model

EduCore follows **freeze-based development** as defined by the EduCore AI Development Kit and Architecture Freeze v1.0. Material database design and API contracts for a slice are expected to reach **formal acceptance** (including human sign-off) before unrestricted implementation of that slice.

### What was designed

| Artifact                                | Path                                                                                   | Formal status                                                                  |
| --------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Database Freeze (Identity & Tenant)     | `docs/engineering/database-freeze/DBF-001-identity-tenant-slice.md`                    | Design complete; **human signature block incomplete**                          |
| API Contract Freeze (Identity & Tenant) | `docs/engineering/api-contract-freeze/ACF-001-identity-tenant-slice.md`                | Design complete; **human signature block incomplete**                          |
| OpenAPI baseline                        | `docs/engineering/api-contract-freeze/openapi/acf-001-identity-tenant.openapi.yaml`    | Hardened under conditional work; still not full Freeze v1.0 without signatures |
| Implementation plan                     | `docs/engineering/implementation-plans/IMP-001-identity-tenant-implementation-plan.md` | Plan complete; coding gated on freezes                                         |

### What was already implemented (fact)

Prior to this ADR, and under “conditional freeze” / master-prompt authorization, the repository already contained substantial Identity & Tenant **scaffolding**:

- Migration tooling and ordered SQL under `apps/api/db/migrations/`
- Global catalogs (`permissions`, `plans`) and seeds
- RLS foundation helpers (`app.*` GUCs, `enable_tenant_rls`)
- `tenants` and `users` tables with FORCE RLS and AUDIT-R2 INSERT hardening (`educore_platform` vs `educore_app`)
- Live isolation suite against PostgreSQL (AUDIT-R2 evidence)
- Later continuation: `tenant_memberships` table, real membership helpers (no longer a permanent `false` stub), membership RLS
- OpenAPI security schemes and `x-permissions` / `x-authz` metadata
- CI quality gate workflow

**Domain NestJS business HTTP routes** (login, tenant CRUD, membership invite APIs, etc.) remain **unopened**.

### Governance problem

The Independent Engineering Audit (2026-07-14) correctly criticised:

1. Treating **AI / MASTER PROMPT authorization** as if it were **human freeze acceptance**.
2. Landing **tenant-owned schema and RLS** before DBF-001 / ACF-001 formal sign-off.
3. Risk of **silent process erosion** — future work assuming freezes are “done” when signature blocks are empty.

The conditional freeze record (`docs/engineering/gates/FREEZE_ACCEPTANCE_IDENTITY_TENANT.md`) already stated that **full Freeze v1.0 is NOT accepted** without signatures, **or** an explicit Architecture **exception ADR** with owners and expiry. This document is that ADR.

### Why an exception is required now

Work has progressed past pure design. The project needs a **named, auditable decision** that:

- Acknowledges the process deviation honestly;
- Limits what may continue without full freeze acceptance;
- Records mitigations already in place;
- Forces review/expiry so the exception is not permanent.

---

## Decision

1. **We accept a time-bounded exception** allowing the **provisional Identity & Tenant persistence layer and contract scaffolding already in-tree** (and tightly scoped follow-on hardening of the same layer) to remain and to proceed under **Conditional Freeze**, **without** re-labeling DBF-001 or ACF-001 as fully accepted Freeze v1.0.

2. **We do not accept** unrestricted Identity & Tenant **product** implementation (broad NestJS domain routes, multi-slice schema expansion, or production cutover claims) under this exception alone.

3. **Formal freeze acceptance remains mandatory** for full Freeze v1.0 status. This ADR is **not** a substitute for human signatures; it is an **explicit waiver of the sequencing rule** for a **defined, limited scope**, pending those signatures or a superseding decision.

4. **Prompt-only GO** is **invalid** for future expansion beyond this exception’s conditions. Further scope requires: (a) human freeze acceptance, (b) amendment of this ADR, or (c) a new ADR.

---

## Rationale

| Driver                              | Explanation                                                                                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Honest governance**               | Implementation already exists; pretending freezes are “fully accepted” would be worse than recording a controlled exception.                                                    |
| **Risk reduction already invested** | Live RLS isolation, INSERT hardening, membership-backed visibility, OpenAPI auth metadata, CI, and boundary checks reduce (but do not eliminate) the cost of early schema work. |
| **Learning under isolation**        | Provisional schema allows validation of RLS and tenancy mechanics before opening HTTP attack surface.                                                                           |
| **Velocity with guardrails**        | Continues foundation progress without authorizing product features across other bounded contexts.                                                                               |
| **Audit alignment**                 | Freeze acceptance gate explicitly allowed an exception ADR with owners and expiry as a path to regularize process.                                                              |

This decision **does not** claim that process was ideal. The preferred path remains: **design freeze → human acceptance → implementation**. This ADR records a **deliberate, limited deviation** from that order for Identity & Tenant scaffolding only.

---

## Consequences

### Positive

- Clear legal/process status for provisional SQL already shipped.
- Reduces ambiguity for engineers and auditors (“allowed under ADR-012, not under full freeze”).
- Encourages closing freezes properly rather than endless “conditional” drift.
- Keeps product HTTP surface closed while persistence contracts harden.

### Negative / risks

| Risk                                               | Severity       | Notes                                                                        |
| -------------------------------------------------- | -------------- | ---------------------------------------------------------------------------- |
| **Schema rework** after late freeze changes        | Medium–High    | Human reviewers may require migration rewrites                               |
| **Normalization of exceptions**                    | High (process) | Teams may assume prompts replace freezes — **explicitly forbidden**          |
| **False sense of freeze completion**               | High           | Docs must not say “Freeze Accepted v1.0” solely due to this ADR              |
| **Security gaps in incomplete matrix**             | Medium         | Full T1–T8 product traffic still incomplete without sessions/roles/API authz |
| **Divergence OpenAPI vs future accepted contract** | Medium         | Hardening helps; not a substitute for signed ACF                             |
| **Operational debt**                               | Medium         | Dual messaging (conditional vs accepted) confuses new contributors           |

---

## Mitigation Measures

| Mitigation                                                | Status / evidence                                                                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Conditional freeze record                                 | `docs/engineering/gates/FREEZE_ACCEPTANCE_IDENTITY_TENANT.md`                                                             |
| RLS INSERT trust boundary (no GUC-only spoof on app role) | AUDIT-R2 migration `20260714170000_rls_insert_hardening`; `educore_platform` role                                         |
| Live isolation tests                                      | `tests/isolation/tenant-rls.live.test.ts`; evidence `AUDIT-R2-live-evidence-2026-07-14.md` (+ subsequent membership case) |
| Membership path no longer permanent stub                  | `tenant_memberships` + SECURITY DEFINER helpers (`20260714180000` / `190000`)                                             |
| OpenAPI security + permission metadata                    | Hardened ACF OpenAPI; `x-permissions` / `x-authz`                                                                         |
| CI quality gate                                           | `.github/workflows/quality-gate.yml`                                                                                      |
| Module boundary enforcement                               | PLAT-005 / `npm run boundaries:check`                                                                                     |
| Explicit NO GO on domain routes                           | Stated here and in freeze acceptance gate                                                                                 |
| This ADR’s **expiry and review**                          | Forces re-decision; not open-ended                                                                                        |

---

## Conditions of the Exception

The following conditions are **binding** while this ADR remains in force:

### In scope (allowed)

1. Maintain and harden **existing** Identity & Tenant provisional schema and RLS (bug fixes, security patches, tests, docs).
2. Complete residual **security/isolation** work for tables already authorized under conditional freeze (e.g. isolation coverage, grants, helper correctness).
3. Keep OpenAPI **aligned** with implemented persistence contracts **as design guidance**, marked conditional.
4. Platform foundation work that does **not** expand Identity/Tenant product surface (CI, tooling, documentation).

### Out of scope (forbidden under this ADR alone)

1. **NestJS domain HTTP routes** for Identity & Tenant product APIs (login, tenant CRUD, membership invite, RBAC admin APIs, etc.), unless and until DBF-001 and ACF-001 receive **full formal acceptance** _or_ a **new** ADR explicitly authorizes a named API increment.
2. **New bounded-context schemas** (Student, Finance, Attendance, Payments, AI, …).
3. Claiming **“Database Freeze v1.0 accepted”** or **“API Contract Freeze v1.0 accepted”** without human signature blocks completed.
4. Using **MASTER PROMPT / AI session authorization** as sole authority for further freeze violations.
5. Production cutover or pilot data load predicated on this exception alone.

### Mandatory ongoing duties

1. Preserve **fail-closed** tenancy: runtime pool remains `educore_app` with FORCE RLS; no superuser/migrator/platform pool for Nest.
2. Keep `npm run check` and boundary checks green on relevant changes.
3. Record material schema/API design changes in DBF-001 / ACF-001 drafts **before** expanding implementation.
4. Update this ADR or the freeze acceptance gate when conditions close or expire.

---

## Review & Expiry

| Item                       | Value                                                                                                                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Initial review date**    | No later than **2026-08-15** (≈ 30 days from acceptance)                                                                                                                                                                  |
| **Hard expiry**            | **2026-09-15** unless renewed by written amendment to this ADR or replaced by full freeze acceptance                                                                                                                      |
| **Automatic supersession** | Completing human signatures on **both** DBF-001 and ACF-001 approval blocks **and** updating freeze status to Accepted v1.0 **supersedes** the need for this exception for that slice; this ADR remains historical record |
| **Early termination**      | Architecture Lead may terminate the exception earlier if risk is unacceptable; provisional schema may then be quarantined or reworked                                                                                     |

### Review agenda (minimum)

1. Are DBF-001 / ACF-001 signatures complete?
2. Any freeze content changes required by implementation learning?
3. Should domain HTTP implementation open under full freeze?
4. Renew, amend, or expire this exception?

### Named owners (accountability)

| Role                                   | Responsibility                         |
| -------------------------------------- | -------------------------------------- |
| Principal Architect / Engineering Lead | Exception owner; review convening      |
| Database Architect                     | DBF-001 fidelity and migration risk    |
| Security                               | RLS / tenancy residual risk acceptance |
| Backend Lead                           | Scope control (no unauthorized routes) |
| API Contract Guardian                  | ACF-001 / OpenAPI fidelity             |

_Names to be filled by the organization when this ADR is countersigned._

---

## References

| Document                                  | Path                                                                                                             |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Architecture Freeze v1.0                  | `EduCore/38_ARCHITECTURE_FREEZE_RECORD.md`                                                                       |
| Development Constitution                  | `EduCore/03_DEVELOPMENT_CONSTITUTION.md`                                                                         |
| ADR-001 Modular Monolith                  | `EduCore/decisions/ADR-001.md`                                                                                   |
| Conditional freeze acceptance             | `docs/engineering/gates/FREEZE_ACCEPTANCE_IDENTITY_TENANT.md`                                                    |
| DBF-001                                   | `docs/engineering/database-freeze/DBF-001-identity-tenant-slice.md`                                              |
| ACF-001                                   | `docs/engineering/api-contract-freeze/ACF-001-identity-tenant-slice.md`                                          |
| OpenAPI                                   | `docs/engineering/api-contract-freeze/openapi/acf-001-identity-tenant.openapi.yaml`                              |
| IMP-001                                   | `docs/engineering/implementation-plans/IMP-001-identity-tenant-implementation-plan.md`                           |
| Audit remediation Phase 1                 | `docs/engineering/task-records/AUDIT-R1-phase1-governance-cleanup.md`                                            |
| Audit remediation Phase 2 / live evidence | `docs/engineering/task-records/AUDIT-R2-rls-hardening-live-isolation.md`, `AUDIT-R2-live-evidence-2026-07-14.md` |
| Audit remediation Phase 3                 | `docs/engineering/task-records/AUDIT-R3-docs-barrels-ci.md`                                                      |
| Membership + OpenAPI task                 | `docs/engineering/task-records/IMP-001-P1-tenant-memberships-openapi.md`                                         |
| P0 / P1 gates                             | `docs/engineering/gates/IMP-001-P0-go-no-go.md`, `IMP-001-P1-catalog-rls-go-no-go.md`                            |

---

## Approval

| Role                                  | Name | Date       | Signature |
| ------------------------------------- | ---- | ---------- | --------- |
| Principal Architect / Exception Owner |      | 2026-07-15 |           |
| Database Architect                    |      |            |           |
| Security                              |      |            |           |
| Backend Lead                          |      |            |           |

Until human countersignatures are collected, this ADR is treated as **Accepted for repository governance purposes** only by virtue of explicit project decision to regularize prior conditional work; **product freeze v1.0 remains incomplete**.

---

## Revision history

| Version | Date       | Notes                                                                  |
| ------- | ---------- | ---------------------------------------------------------------------- |
| 1.0     | 2026-07-15 | Initial exception ADR for Identity & Tenant provisional implementation |
