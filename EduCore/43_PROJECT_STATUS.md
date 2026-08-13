# 43 Project Status

## Status Authority

This is the canonical status page for EduCore. It answers what is complete, what is frozen, what is flexible, what is allowed now, and what must happen next. It does not override the Development Constitution, accepted ADRs, or an approved freeze record.

**Honesty:** Freeze acceptance language below is under **solo-operator consolidation (SOLO-GOV-001)** unless an independent multi-person countersign is recorded. That is not the same as unrestricted production approval.

## Current Phase

**Staging lab MVP live (Frankfurt), post–Engineering Sprint 0. Production / public pilot still NO GO.**

- Architecture Freeze v1.0 remains the kit baseline (`38_ARCHITECTURE_FREEZE_RECORD.md`).
- Independent Engineering Readiness Review (`42_ENGINEERING_READINESS_REVIEW.md`) remains **NO GO for unrestricted production / public pilot**.
- Domain work proceeds only behind **slice** Database / API / provisional Design freezes and IMP gates under SOLO-GOV-001 — not as open-ended production feature development.

Last status sync: **2026-08-13**.

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
- Admin ops UI polish closed for AUDIT-ADMIN-UI-R1 (IMP-027…046).
- Teacher attendance/marks UI; parent/guardian fee visibility (Fake payments path).
- Office fees path: structures → invoices → office payment → receipts (real MoMo **not** integrated).
- **Staging FRA:** Fly `educore-api-staging` + Neon `educore-staging-fra`; D1 Pass (2026-08-08 + FRA re-check 2026-08-10); D2 Pass (app redeploy 2026-08-13); Auth0 US PKCE; **MFA_ENFORCE=hard**.
- **Production infra (not GO):** Fly `educore-api` (fra) + Neon `educore-prod` + Doppler `prd`; `/health` green; IdP local; **MFA_ENFORCE=hard** (F-002, 2026-08-13); Fake payments.

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
| Kit-wide Design System Freeze | **Accepted (provisional):** `DSF-KIT-001` v1.0 — slice DSF-001…006 still govern screens |
| Production IdP / MFA | **WEB-AUTH0** (US tenant residual); **WEB-MFA-UI**; staging **MFA-HARD** live (Owner enrolled TOTP) |
| Hosting, IaC, secrets provider, RPO/RTO | **Live staging + prod infra:** Fly.io + Neon Frankfurt + Doppler; RPO≤24h; RTO≤8h (D1/D2 evidence). Prod `educore-api` is **infra live, not Board GO**. Neon PITR max **6h** on current plan |
| First **real** payment provider | **Chosen:** ClickPesa (`clickpesa`) for Zanzibar — PAY-001 Accepted; Fake default until adapter + secrets |
| AI provider / release gate | **Lab adapter chosen:** OpenAI (`openai`) env-gated; Fake CI default; product features still gate-blocked (`lab.echo` only) |
| Offline attendance worker | Foundation/docs path; not production offline cutover |
| Independent multi-person freeze re-sign | Open (SOLO-GOV-001 honesty residual) |

## Work Allowed Now

1. Gated IMP increments behind **existing** accepted/provisional slice freezes (DBF/ACF/DSF), with SOLO-GOV-001 honesty in docs.
2. Hardening, isolation tests, OpenAPI/docs sync, and Admin/Teacher/Parent UX polish **within** frozen contracts.
3. Decision briefs that close open limitations (**PAY-001…006** lab shipped; **PAY-OPS-001** when keys).
4. Engineering Readiness **re-review preparation** before any production/pilot claim.

## Work Not Allowed Now

- Unrestricted production feature development or public pilot cutover.
- Real mobile-money vendor SDK/credentials without a superseding payment decision + sandbox contract + webhook security spec.
- Inventing schema/API/UI outside the governing slice freeze.
- High-risk AI, MFA-less privileged production finance admin claims, or silent architecture redesign.
- Treating solo-operator signatures as independent external peer review.

## Next Milestone

**Lab/staging MVP** — **Done (provisional, SOLO-GOV-001).** Production still **NO GO**.

Closed:

1. ~~B-05~~ Fly.io + Neon + Doppler; RPO≤24h; RTO≤8h.
2. ~~B-04~~ Lite threat model.
3. ~~B-07 stub + D1~~ SLOs + executed DB restore (FRA re-check Pass).
4. ~~B-03 / DSF-KIT-001~~ Kit-wide Design System Freeze Accepted (`DSF-KIT-001`).
5. ~~OPS-001 / FLY-DOCKER / OPS-EXEC~~ Staging provisioned; D1 evidence on `main`.
6. ~~WEB-AUTH0 + MFA-HARD~~ Staging privileged path requires TOTP.

Owner close-out **before Board re-review**:

1. ~~**D2**~~ Pass — Fly staging redeploy + health (not PITR rewire).
2. ~~**Weekly Neon PITR glance**~~ Done — plan max 6h (7d rejected).
3. ~~**Secrets hygiene**~~ Staging `SEED_ADMIN_PASS` rotated + applied (retrieve via Doppler locally).
4. **PAY-OPS-001** still blocked — no ClickPesa keys; runtime Fake.
5. **Board re-review** of `42` — **still required**; chat / SOLO-GOV-001 ≠ that review.
6. ~~**Production Fly + Neon + Doppler**~~ Infra live (`OPS-PROD-001`) — **not** GO.

**Governance:** Full Board re-review still required per `42_ENGINEERING_READINESS_REVIEW.md`.

## Naming Convention

- **Architecture Sprint 0**: completed planning and architecture validation (`roadmap/sprint0_planning_validation.md`).
- **Engineering Sprint 0**: non-business technical foundation (`roadmap/sprint0_engineering_foundation.md`) — exit note `SPRINT0_ENGINEERING_EXIT_NOTE.md`.
- **Feature slices / IMP programs**: gated production-shaped work under slice freezes (Identity → Students → Academic → Attendance → Marks → Guardians → Fees → Admin UI polish).
- **Next epic focus**: Independent **Board re-review** of `42`; **PAY-OPS** when ClickPesa keys; Neon plan upgrade if weekly PITR window is required.

## Status Update Rules

Update this page when a freeze gate changes, a blocker closes, the active sprint/epic changes, a decision affects implementation permission, or a release/pilot status changes. Record material decisions through ADRs and material history in `CHANGELOG.md`.
