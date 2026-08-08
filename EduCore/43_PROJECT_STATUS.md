# 43 Project Status

## Status Authority

This is the canonical status page for EduCore. It answers what is complete, what is frozen, what is flexible, what is allowed now, and what must happen next. It does not override the Development Constitution, accepted ADRs, or an approved freeze record.

**Honesty:** Freeze acceptance language below is under **solo-operator consolidation (SOLO-GOV-001)** unless an independent multi-person countersign is recorded. That is not the same as unrestricted production approval.

## Current Phase

**Controlled MVP vertical-slice implementation (lab / local), post–Engineering Sprint 0.**

- Architecture Freeze v1.0 remains the kit baseline (`38_ARCHITECTURE_FREEZE_RECORD.md`).
- Independent Engineering Readiness Review (`42_ENGINEERING_READINESS_REVIEW.md`) remains **NO GO for unrestricted production / public pilot**.
- Domain work proceeds only behind **slice** Database / API / provisional Design freezes and IMP gates under SOLO-GOV-001 — not as open-ended production feature development.

Last status sync: **2026-07-31**.

## Completed And Approved

### Kit / architecture

- Product vision, project brief, product requirements, and consolidated SRS.
- Domain vocabulary and bounded-context direction.
- Architecture Review and Architecture Freeze v1.0.
- ADR-001 through ADR-011 (kit); engineering ADRs including ADR-012 (historical sequencing exception); **PAY-001 Accepted** (ClickPesa / Zanzibar) amending `PAY-PROVIDER-001` (Fake remains CI default).
- AI Development Kit v2.0, implementation roadmap, Master Engineering Execution Prompt, and AI-EOS.
- Engineering Readiness Review and its blocker register (verdict still NO GO for unrestricted production).

### Engineering foundation

- Monorepo workspace, CI (`npm run check`), Nest modular monolith skeleton, Postgres + RLS tooling, local Docker path, structured logging / health / error envelope.
- Engineering Sprint 0 foundation work largely executed (see `roadmap/sprint0_engineering_foundation.md` and `docs/engineering/`).

### Slice freezes (solo-operator Accepted / provisional)

Authoritative artifacts live under `docs/engineering/` (not rewritten into kit freeze v1.0 wording):

| Gate | Coverage (summary) |
| ---- | ------------------ |
| DBF-001…012 | Identity/tenant, students, academic structure, enrollments, attendance, guardians, marks, finance fees |
| ACF-001…013 | Matching API contract slices + parent portal fees |
| DSF-001…006 | Provisional UI slices: teacher attendance/marks, admin shell/guardians/academic, admin fees, parent fees/portal |
| FREEZE-ACC-001 | Identity & Tenant Accepted v1.0 (solo-operator) |

### Product surface shipped in lab (gated IMP)

- Auth sessions, tenant bind, memberships/roles/permissions (deny-by-default).
- Admin ops UI polish closed for AUDIT-ADMIN-UI-R1 (IMP-027…035 + Wave X + IMP-028 AdminTable residual).
- Teacher attendance/marks UI; parent/guardian fee visibility (Fake payments path).
- Office fees path: structures → invoices → office payment → receipts (real MoMo **not** integrated).

## Frozen

### Architecture (kit)

The architecture baseline is defined by `38_ARCHITECTURE_FREEZE_RECORD.md`:

- `03_DEVELOPMENT_CONSTITUTION.md`.
- `34_SOFTWARE_REQUIREMENTS_SPECIFICATION.md`.
- `35_PROJECT_ARCHITECTURE.md`.
- `36_ARCHITECTURE_VALIDATION_SPRINT.md`.
- `37_FINAL_ARCHITECTURE_REVIEW.md`.
- Accepted ADRs.

A material architecture change requires an ADR, impact review, affected-document update, and a new freeze record.

### Slice contracts (engineering)

Within an accepted DBF/ACF slice, inventing tables/endpoints outside that freeze requires a slice revision. Provisional DSF slices do **not** equal kit-wide Design System Freeze acceptance.

## Still Flexible / open

| Area | Status |
| ---- | ------ |
| Kit-wide Design System Freeze | Not accepted — **B-03 posture**: provisional DSF-001…006 only (`B-03-design-system-freeze-posture.md`) |
| Production IdP / MFA | IdP/OIDC not chosen; **TOTP MFA-HARD continuous gate Done** (soft lab default) |
| Hosting, IaC, secrets provider, RPO/RTO | **Chosen (provisional):** Fly.io + Neon + Doppler; FRA; RPO≤24h; RTO≤8h — live provision deferred |
| First **real** payment provider | **Chosen:** ClickPesa (`clickpesa`) for Zanzibar — PAY-001 Accepted; Fake default until adapter + secrets |
| AI provider / release gate | **Lab adapter chosen:** OpenAI (`openai`) env-gated; Fake CI default; product features still gate-blocked (`lab.echo` only) |
| Offline attendance worker | Foundation/docs path; not production offline cutover |
| Independent multi-person freeze re-sign | Open (SOLO-GOV-001 honesty residual) |

## Work Allowed Now

1. Gated IMP increments behind **existing** accepted/provisional slice freezes (DBF/ACF/DSF), with SOLO-GOV-001 honesty in docs.
2. Hardening, isolation tests, OpenAPI/docs sync, and Admin/Teacher/Parent UX polish **within** frozen contracts.
3. Decision briefs that close open limitations (**PAY-001 done**; next **PAY-002** ClickPesa adapter contract).
4. Engineering Readiness **re-review preparation** before any production/pilot claim.

## Work Not Allowed Now

- Unrestricted production feature development or public pilot cutover.
- Real mobile-money vendor SDK/credentials without a superseding payment decision + sandbox contract + webhook security spec.
- Inventing schema/API/UI outside the governing slice freeze.
- High-risk AI, MFA-less privileged production finance admin claims, or silent architecture redesign.
- Treating solo-operator signatures as independent external peer review.

## Next Milestone

**Readiness decision stubs B-03…B-07** — **Done** (provisional). Production still **NO GO**.

Required outputs:

1. ~~B-05~~ Fly.io + Neon + Doppler; RPO≤24h; RTO≤8h.
2. ~~B-04~~ Lite threat model.
3. ~~B-07~~ Pilot SLOs + restore-drill schedule.
4. ~~B-03~~ Provisional DSF posture locked (`B-03-design-system-freeze-posture.md`); kit-wide DSF residual stands.
5. ~~OPS-001~~ Staging provision + D1 runbook published (`docs/engineering/runbooks/OPS-001-staging-provision-and-d1.md`).
6. Operator: execute OPS-001; run D1 restore smoke; no secrets in git.
7. Do **not** claim public pilot until executed drills + IdP/support residuals addressed.

**Parallel:** Sprint 0 exit note recorded; MFA-HARD / AI / COMMS lab Done.

**Governance:** Full Board re-review still required per `42_ENGINEERING_READINESS_REVIEW.md`.

## Naming Convention

- **Architecture Sprint 0**: completed planning and architecture validation (`roadmap/sprint0_planning_validation.md`).
- **Engineering Sprint 0**: non-business technical foundation (`roadmap/sprint0_engineering_foundation.md`) — exit note `SPRINT0_ENGINEERING_EXIT_NOTE.md`.
- **Feature slices / IMP programs**: gated production-shaped work under slice freezes (Identity → Students → Academic → Attendance → Marks → Guardians → Fees → Admin UI polish).
- **Next epic focus**: **OPS-001 execute** / `GO FLY-DOCKER` / D1; PAY-OPS when keys; IdP later; optional `GO DSF-KIT`.

## Status Update Rules

Update this page when a freeze gate changes, a blocker closes, the active sprint/epic changes, a decision affects implementation permission, or a release/pilot status changes. Record material decisions through ADRs and material history in `CHANGELOG.md`.
