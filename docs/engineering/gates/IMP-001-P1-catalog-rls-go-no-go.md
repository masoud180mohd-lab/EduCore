# IMP-001 Phase P1 (partial) — Catalog + RLS Foundation Gate

## Gate ID

`IMP-001-P1-CATALOG-RLS-GATE`

## Purpose

Authorize a **narrow P1 increment**: global catalog tables (`permissions`, `plans`), seeds, and RLS helper foundation — without tenant-owned business tables or HTTP domain APIs.

## Decision

### Allowed now (CONDITIONAL GO)

| Allowed                                        | Rationale                                     |
| ---------------------------------------------- | --------------------------------------------- |
| Extensions migration                           | Required by DBF-001                           |
| `permissions` + `plans` tables                 | Global catalogs; no `tenant_id` RLS required  |
| Deterministic catalog seeds                    | DBF-001 §13 permission codes + baseline plans |
| `app.*` GUC helpers + `enable_tenant_rls()`    | Security foundation before tenant tables      |
| Read-only grants for `educore_app` on catalogs | Hardening                                     |

### Still NO-GO in this increment

| Blocked                                                                       | Until                                                     |
| ----------------------------------------------------------------------------- | --------------------------------------------------------- |
| Tenant-owned tables (`tenants`, `users`, memberships, roles, entitlements, …) | RLS policies attached + isolation tests (IMP-001 T06–T11) |
| NestJS domain controllers / services                                          | P2+ after persistence isolation                           |
| Claiming formal freeze acceptance                                             | Human signatures on DBF-001 / ACF-001                     |

## Authority

- MASTER PROMPT: Start Phase P1 Catalog Tables + RLS Foundation
- DBF-001 design package
- IMP-001 task T05 + T10 foundation
- P0 gate remains in force for overall process

## Sign-off

| Role                               | Decision                                | Date       |
| ---------------------------------- | --------------------------------------- | ---------- |
| Engineering (prompt authorization) | **GO (catalogs + RLS foundation only)** | 2026-07-14 |

## Governance remediation note (2026-07-14)

Independent Engineering Audit (G2) found that **prompt / MASTER PROMPT authorization is not valid freeze acceptance**, and that tenant-owned tables (`tenants` / `users`) were later added **beyond this gate’s NO-GO list**.

Binding status:

- Provisional scaffolding is governed only by `docs/engineering/gates/FREEZE_ACCEPTANCE_IDENTITY_TENANT.md` (**CONDITIONAL ACCEPTANCE**).
- This catalog gate’s NO-GO for tenant-owned tables is **restored as process truth** until Phase 2 closes Critical G3 (RLS + live isolation) and human signatures land.
- No additional tenant-owned tables may be added under prompt authorization alone.
