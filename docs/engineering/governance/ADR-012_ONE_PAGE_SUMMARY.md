# ADR-012 — One-Page Summary (Countersignature Pre-read)

|                 |                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------- |
| **Full ADR**    | `docs/engineering/decisions/ADR-012-exception-identity-tenant-implementation.md`                |
| **Status**      | Accepted (time-bounded **exception**) — Principal Architect signed 2026-07-15                   |
| **Your action** | Countersign by **2026-08-08** · Attend review **2026-08-13** (binding review-by **2026-08-15**) |

---

## What this ADR is

A **governance exception**, not a product redesign. It allows **provisional** Identity & Tenant persistence and contract scaffolding under **Conditional Freeze**, while admitting that full DBF-001 / ACF-001 Freeze v1.0 human signatures are still incomplete.

**Signing ADR-012 ≠ accepting Freeze v1.0.**

---

## Why it exists

1. Schema and RLS work landed **before** formal freeze signatures (process deviation found by Independent Audit).
2. Pretending freezes are “fully accepted” would be worse than an **honest, time-bounded** waiver.
3. Freeze gate allowed an exception ADR with **owners, conditions, and expiry** — this is that record.

---

## Decision (in one sentence)

Keep and harden Identity & Tenant **scaffolding** under Conditional Freeze; do **not** open Nest domain product HTTP or claim Freeze v1.0 without human signatures.

---

## In scope (allowed)

- Maintain / harden existing provisional schema & RLS
- Isolation tests, grants, helper correctness
- Align OpenAPI as **design guidance** (still conditional)
- Platform/CI/docs that do not expand product surface

## Out of scope (forbidden under this ADR alone)

- Nest Identity/Tenant **product** HTTP (login, tenant CRUD, membership invite, RBAC admin, …)
- New bounded-context schemas (Student, Finance, …)
- Claiming “DB Freeze / API Freeze Accepted v1.0” without signature blocks
- Using MASTER PROMPT / AI chat as freeze authority
- Production cutover on this exception alone

---

## Key dates

| Event                                            | Date           |
| ------------------------------------------------ | -------------- |
| Accepted (PA)                                    | 2026-07-15     |
| Countersignatures due                            | **2026-08-08** |
| Review meeting (recommended)                     | **2026-08-13** |
| Binding review-by                                | **2026-08-15** |
| Hard expiry (unless renewed or freezes accepted) | **2026-09-15** |

---

## Main risks (acknowledged)

| Risk                                           | Severity    |
| ---------------------------------------------- | ----------- |
| Late freeze changes force migration rework     | Medium–High |
| Teams treat exceptions as normal               | High        |
| Docs mislabeled “freeze accepted”              | High        |
| Incomplete tenancy/auth for production traffic | Medium      |

**Mitigations already cited:** RLS INSERT hardening, live isolation evidence, memberships, OpenAPI auth metadata, CI, module boundaries, explicit HTTP NO GO, this ADR’s expiry.

---

## Countersigners requested

| Role               | Name            | Signature phrase                                            |
| ------------------ | --------------- | ----------------------------------------------------------- |
| Database Architect | PM Master       | `Countersigned — exception only; Freeze v1.0 still pending` |
| Security Lead      | Masoud Salum    | _(same)_                                                    |
| Backend Lead       | Rashid Mohammed | _(same)_                                                    |

---

## After you sign

1. Accept the **2026-08-13** review invite.
2. Freeze v1.0 signatures on **DBF-001** and **ACF-001** remain a **separate** track (target ≤ 2026-09-01).
3. HTTP stays closed until Freeze v1.0 **and** an explicit GO gate (or a new ADR).

---

_Full detail, conditions, approval block, and references: ADR-012 (complete document)._
