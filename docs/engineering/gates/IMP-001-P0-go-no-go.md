# IMP-001 Phase P0 — Go / No-Go Gate (T01)

## Gate ID

`IMP-001-P0-GATE`

## Purpose

Record whether Engineering may begin **Phase P0 scaffolding** (migration tooling, DB roles documentation, contract/test harness foundations) for the Identity & Tenant slice — **without** business schema (P1) or domain controllers (P2+).

## Spec references

| Artifact | Path                                                                                   | Status at gate time                                                   |
| -------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| DBF-001  | `docs/engineering/database-freeze/DBF-001-identity-tenant-slice.md`                    | Design complete; formal human signatures still open                   |
| ACF-001  | `docs/engineering/api-contract-freeze/ACF-001-identity-tenant-slice.md`                | Design complete (OpenAPI present); formal human signatures still open |
| OpenAPI  | `docs/engineering/api-contract-freeze/openapi/acf-001-identity-tenant.openapi.yaml`    | Present                                                               |
| IMP-001  | `docs/engineering/implementation-plans/IMP-001-identity-tenant-implementation-plan.md` | Plan complete                                                         |
| DEV-001  | Local Docker Postgres/Redis                                                            | Compose present; runtime depends on host Docker                       |

## Checklist

| #   | Criterion                                                   | Result                                                 |
| --- | ----------------------------------------------------------- | ------------------------------------------------------ |
| 1   | Architecture Freeze v1.0 accepted (kit)                     | **Met**                                                |
| 2   | DBF-001 design package exists and is reviewable             | **Met**                                                |
| 3   | ACF-001 design package + OpenAPI exists and is reviewable   | **Met**                                                |
| 4   | DBF-001 / ACF-001 formal signature block completed          | **Open** (proposed for acceptance)                     |
| 5   | Explicit sprint authorization for P0 scaffolding            | **Met** (MASTER PROMPT: Start Implementation Phase P0) |
| 6   | Scope excludes business tables and domain controllers in P0 | **Met** (this gate enforces)                           |
| 7   | PLAT-005 boundary checks remain required                    | **Met** (`npm run boundaries:check`)                   |
| 8   | App runtime must not use migrator/superuser role            | **Met** (documented in T02)                            |

## Decision

### P0 scaffolding (T01–T04 foundations)

**CONDITIONAL GO**

| Allowed                                                    | Not allowed                                                |
| ---------------------------------------------------------- | ---------------------------------------------------------- |
| Migration runner + empty baseline migration                | P1 business table migrations (`tenants`, `users`, …)       |
| Bootstrap SQL for `educore_migrator` / `educore_app` roles | NestJS domain controllers / services for Identity & Tenant |
| Contract-test harness loading OpenAPI fixtures             | Student / Finance / Attendance work                        |
| Test DB lifecycle scripts (optional Docker)                | Claiming full freeze “accepted” without signatures         |
| Docs + task records for P0                                 | Production cloud topology / secret manager selection       |

### P1+ (schema, RLS policies on business tables, APIs)

**NO-GO until** DBF-001 and ACF-001 formal acceptance signatures are recorded **or** a written Architecture exception is filed.  
P0 does not authorize P1 merges of business schema.

## Branch / PR policy (Identity & Tenant slice)

1. PR title should include task id when implementing plan items, e.g. `IMP-001-T02: migration tooling`.
2. PR description must link **DBF-001** and **ACF-001** (and OpenAPI path).
3. Use `docs/engineering/templates/PR_CHECKLIST_IDENTITY_TENANT.md`.
4. Required checks: `npm run check` (format, lint, typecheck, test, env, boundaries).
5. Reject PRs that add tables outside DBF-001 or routes outside ACF-001 without a freeze revision.
6. Reject PRs that connect the Nest app pool as superuser/migrator.

## Skills applied (T01)

| Skill                       | Use                                                   |
| --------------------------- | ----------------------------------------------------- |
| planning-and-task-breakdown | Separated P0 GO from P1 NO-GO                         |
| spec-driven-development     | Freezes + OpenAPI listed as authority                 |
| security-and-hardening      | Runtime role restriction; no silent freeze acceptance |
| code-review-and-quality     | PR checklist required                                 |

## Sign-off

| Role                                  | Decision         | Date       | Notes                        |
| ------------------------------------- | ---------------- | ---------- | ---------------------------- |
| Engineering (P0 prompt authorization) | **GO (P0 only)** | 2026-07-14 | MASTER PROMPT Start Phase P0 |
| Formal freeze signatories             | Pending          | —          | Complete before P1           |

## Governance remediation note (2026-07-14)

Independent Engineering Audit (G2) found that **prompt / MASTER PROMPT authorization is not valid freeze acceptance**. This P0 gate remains historically recorded. Binding Identity & Tenant governance is now:

- `docs/engineering/gates/FREEZE_ACCEPTANCE_IDENTITY_TENANT.md` — **CONDITIONAL ACCEPTANCE** only.
- Formal DBF-001 / ACF-001 signatures remain required for full freeze acceptance.
- Further gates must not be self-approved solely by an AI prompt name.

## Residual blockers for later phases

1. Human signatures on DBF-001 / ACF-001 approval blocks.
2. Docker available on implementer machine for live migrate dry-runs (DEV-001).
3. IdP product ADR still optional for dual-ready auth (P3).
4. Audit Phase 2: RLS GUC hardening + live isolation tests (G3).
