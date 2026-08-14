# 43 Project Status

## Status Authority

This is the canonical status page for EduCore. It answers what is complete, what is frozen, what is flexible, what is allowed now, and what must happen next. It does not override the Development Constitution, accepted ADRs, or an approved freeze record.

**Honesty:** EduCore is **Owner + AI** ([SOLO-GOV-002](../docs/engineering/governance/SOLO-GOV-002-owner-plus-ai.md)). Kit Independent Board / architect-team language is retired. That is not a public-pilot stamp.

## Current Phase

**Staging lab MVP live (Frankfurt). Owner + AI. No Independent Board.**

- Architecture Freeze v1.0 remains the kit baseline (`38_ARCHITECTURE_FREEZE_RECORD.md`).
- `42_ENGINEERING_READINESS_REVIEW.md` is a **historical checklist** (Board wrapper retired). Do not wait for re-review.
- Domain work proceeds behind **Owner-accepted** slice Database / API / Design freezes and IMP gates — not as invent-anything production.

Last status sync: **2026-08-13**.

## Completed And Approved

### Kit / architecture

- Product vision, project brief, product requirements, and consolidated SRS.
- Domain vocabulary and bounded-context direction.
- Architecture Review and Architecture Freeze v1.0.
- ADR-001 through ADR-011 (kit); engineering ADRs including ADR-012 (historical sequencing exception); **PAY-001 Accepted** (ClickPesa / Zanzibar) amending `PAY-PROVIDER-001` (Fake remains CI default).
- AI Development Kit v2.0, implementation roadmap, Master Engineering Execution Prompt, and AI-EOS.
- Engineering Readiness Review (`42`) retained as historical checklist; Independent Board never staffed (SOLO-GOV-002).

### Engineering foundation

- Monorepo workspace, CI (`npm run check`), Nest modular monolith skeleton, Postgres + RLS tooling, local Docker path, structured logging / health / error envelope.
- Engineering Sprint 0 foundation work largely executed (see `roadmap/sprint0_engineering_foundation.md` and `docs/engineering/`).

### Slice freezes (Owner-accepted)

Authoritative artifacts live under `docs/engineering/` (not rewritten into kit freeze v1.0 wording):

| Gate | Coverage (summary) |
| ---- | ------------------ |
| DBF-001…012 | Identity/tenant, students, academic structure, enrollments, attendance, guardians, marks, finance fees |
| ACF-001…013 | Matching API contract slices + parent portal fees |
| DSF-001…006 | Owner-accepted UI slices: teacher attendance/marks, admin shell/guardians/academic, admin fees, parent fees/portal |
| FREEZE-ACC-001 | Identity & Tenant Accepted v1.0 (Owner) |

### Product surface shipped in lab (gated IMP)

- Auth sessions, tenant bind, memberships/roles/permissions (deny-by-default).
- Admin ops UI polish closed for AUDIT-ADMIN-UI-R1 (IMP-027…046).
- Teacher attendance/marks UI; parent/guardian fee visibility (pay at office).
- Office fees path: structures → invoices → office payment → receipts (PAY-007 live path; MoMo later).
- **Staging FRA:** Fly `educore-api-staging` + Neon `educore-staging-fra`; D1 Pass (2026-08-08 + FRA re-check 2026-08-10); D2 Pass (app redeploy 2026-08-13); Auth0 US PKCE; **MFA_ENFORCE=hard**.
- **Production infra (Owner lab, not public-school cutover):** Fly `educore-api` + `educore-web` (fra) + Neon `educore-prod` + Doppler `prd`; `/health` green; IdP local; **MFA_ENFORCE=hard** (F-002); office fees (PAY-007). Web: https://educore-web.fly.dev

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

Within an accepted DBF/ACF slice, inventing tables/endpoints outside that freeze requires a slice revision. Slice DSF still governs screens even with `DSF-KIT-001`.

## Still Flexible / open

| Area | Status |
| ---- | ------ |
| Kit-wide Design System Freeze | **Accepted (provisional):** `DSF-KIT-001` v1.1 — slice DSF-001…006 still govern screens |
| Production IdP / MFA | **WEB-AUTH0** (US tenant residual); **WEB-MFA-UI**; staging **and prod** MFA-HARD |
| Hosting, IaC, secrets provider, RPO/RTO | **Live staging + prod infra:** Fly.io + Neon Frankfurt + Doppler. Neon PITR max **6h** on current plan (kit RPO was 24h) |
| First **real** payment provider | **Live:** office cash/bank/cheque (PAY-007). **Later:** ClickPesa — PAY-001 choice unchanged; Fake runtime; no keys |
| AI provider / release gate | **Lab adapter chosen:** OpenAI (`openai`) env-gated; Fake CI default; product features still gate-blocked (`lab.echo` only) |
| Offline attendance worker | Foundation/docs path; not production offline cutover |
| Independent Board / freeze re-sign | **Retired** (SOLO-GOV-002). F-005 withdrawn. |

## Work Allowed Now

1. Gated IMP increments behind **existing** Owner-accepted slice freezes (DBF/ACF/DSF).
2. Hardening, isolation tests, OpenAPI/docs sync, and Admin/Teacher/Parent UX polish **within** frozen contracts.
3. Decision briefs that close open limitations (**PAY-001…007**; **PAY-OPS-001** when Owner can afford ClickPesa).
4. Owner-directed ops (keys, PITR plan, public-school cutover). No Board meeting required.

## Work Not Allowed Now

- Inventing schema/API/UI outside the governing slice freeze.
- Real ClickPesa credentials invented in git/chat; enabling `clickpesa` without Doppler secrets.
- High-risk AI, MFA-less privileged finance admin, or silent architecture redesign.
- Inventing an Independent Board or waiting for fictional countersigners.

## Next Milestone

**Lab/staging MVP** — **Done (Owner + AI).** Public-school cutover is Owner’s call with residuals below.

Closed:

1. ~~B-05~~ Fly.io + Neon + Doppler; RPO≤24h; RTO≤8h.
2. ~~B-04~~ Lite threat model.
3. ~~B-07 stub + D1~~ SLOs + executed DB restore (FRA re-check Pass).
4. ~~B-03 / DSF-KIT-001~~ Kit-wide Design System Freeze Accepted (`DSF-KIT-001`).
5. ~~OPS-001 / FLY-DOCKER / OPS-EXEC~~ Staging provisioned; D1 evidence on `main`.
6. ~~WEB-AUTH0 + MFA-HARD~~ Staging privileged path requires TOTP.

Owner residuals (not Board):

1. ~~**D2**~~ Pass — Fly staging redeploy + health.
2. ~~**Weekly Neon PITR glance**~~ Done — plan max 6h (7d rejected).
3. ~~**Secrets hygiene**~~ Staging `SEED_ADMIN_PASS` rotated.
4. **PAY-OPS-001** deferred (PAY-007) — office collection live; ClickPesa when Owner can fund the account.
5. ~~**Board re-review** of `42`~~ **Retired** (SOLO-GOV-002).
6. ~~**Production Fly + Neon + Doppler**~~ Infra live (`OPS-PROD-001`).
7. ~~**F-002**~~ Prod MFA hard. **F-005** withdrawn.
8. ~~**F-004 / F-016 / F-017 live**~~ Prod migrated; staging + prod Fly images 2026-08-13.
9. ~~**FLY-WEB**~~ `educore-web-staging` + `educore-web` live 2026-08-14.

**Governance:** Owner + AI. `42` is a checklist, not a people-gate.

## Naming Convention

- **Architecture Sprint 0**: completed planning and architecture validation (`roadmap/sprint0_planning_validation.md`).
- **Engineering Sprint 0**: non-business technical foundation (`roadmap/sprint0_engineering_foundation.md`) — exit note `SPRINT0_ENGINEERING_EXIT_NOTE.md`.
- **Feature slices / IMP programs**: gated production-shaped work under slice freezes (Identity → Students → Academic → Attendance → Marks → Guardians → Fees → Admin UI polish).
- **Next epic focus**: use live web for office-fees school workflows; ClickPesa later; Neon plan upgrade if a 24h PITR window is required.

## Status Update Rules

Update this page when a freeze gate changes, a blocker closes, the active sprint/epic changes, a decision affects implementation permission, or a release/pilot status changes. Record material decisions through ADRs and material history in `CHANGELOG.md`.
