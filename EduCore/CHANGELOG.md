# Changelog

All material documentation changes are recorded here. This changelog does not replace ADRs or freeze records.

## 2026-08-12 - IMP-044 Admin chrome Academic details + Roles

- Academic detail pages (year/term/class/stream/subject/enrollment): AdminPageHeader + Banner.
- Roles list + detail: same chrome; hub blurbs tightened (Academic, Roles, Fees receipts).

## 2026-08-12 - IMP-043 Enrollments year + stream filters

- Enrollments Apply: `academicYearId` + `streamId` (stream after class is chosen).
- Completes ACF-008 list filter wiring with IMP-041.

## 2026-08-12 - IMP-042 Organization parent picker

- Create/detail: parent is a select of active organizations (+ Load more), not UUID paste.
- Detail excludes self; seeds current parent by id when not on the first picker page.

## 2026-08-12 - IMP-041 Enrollments list filter parity

- Enrollments: Apply `studentId` + `classId` + `status` (draft/applied; Load more keeps filters).
- URL `?studentId=` filters the list and still prefills create.
- AdminPageHeader + Banner.

## 2026-08-12 - WEB-AUTH0 client env inlining

- `loadAuth0PublicConfig()` reads static `process.env.NEXT_PUBLIC_AUTH0_*` so Next.js inlines them in the browser bundle.
- Dynamic `env[name]` lookups hid the Auth0 button even when `.env.local` was set.

## 2026-08-11 - IMP-040 Admin UUID → display names (wave 2)

- Terms / classes / streams / fee structures: backfill year/class names past the first picker page.
- Terms / classes / streams: wire `search` + `status` Apply/cursor filters.
- Enrollment detail year name; org parent name hint; remove muted detail `Id:` UUID footers.
- Helpers: `resolveYearNames`, `resolveOrganizationNames`, `looksLikeUuid` (+ vitest).

## 2026-08-11 - IMP-039 Admin UUID → display names

- Memberships: resolve user displayName/email instead of raw userId.
- Invoices / enrollments lists: backfill missing student (and class) names beyond the first picker page.
- Student detail enrollments: resolve stream names.
- Shared helpers: `resolveStudentNames`, `resolveUserNames`, `resolveStreamNames`.

## 2026-08-11 - IMP-038 Remaining Admin list filters

- Guardians: wire `search` + `status` (Apply resets cursor).
- Academic years / subjects: wire `search` + `status`; AdminPageHeader + Banner.
- Fee structures: wire `academicYearId` + `status`; AdminPageHeader + Banner.
- Admin hub blurbs updated for Guardians / Academic / Fees filter parity.

## 2026-08-11 - MFA-HARD staging live

- Owner enrolled TOTP; Doppler + Fly `MFA_ENFORCE=hard`.
- Next sign-in requires authenticator code for privileged path.

## 2026-08-11 - MFA-FIX enrollment 500 (ambiguous SQL columns)

- Root cause: PL/pgSQL OUT params vs `factor_type`/`status` columns in MFA helpers.
- Migration `20260811120000_mfa_helpers_ambiguous_columns` applied on staging FRA.

## 2026-08-10 - OPS-HARDEN staging pass

- D1 re-check Pass on Frankfurt Neon (9s) — `B-07-restore-drill-2026-08-10.md`.
- MFA stays soft (0 factors); `ops:stg:mfa-status` helper; hard flip still Owner-gated after enroll.
- Secrets hygiene: unverified-email lab flag absent; PAYMENT fake; Auth0 US residual noted.

## 2026-08-10 - IMP-037 Admin home hub clarity

- Loading/empty states; permission-filtered “Common next steps” deep links; clearer hub blurbs.
- Academic/Fees hubs: AdminPageHeader + back to Admin.

## 2026-08-10 - IMP-036 Admin list filters

- Students / Users: wire `status` alongside existing `search` (Apply resets cursor).
- Invoices: filter by `status`, `studentId`, `academicYearId` (API has no text search).

## 2026-08-09 - UX-POLISH-R1 + MFA-HARD-OPS script

- Teacher/parent/admin chrome polish (class labels, empty states, soft parent copy); no payments.
- `ops-stg-mfa-hard.mjs` + npm scripts for Owner staging MFA_ENFORCE=hard flip (Doppler/flyctl required).

## 2026-08-09 - Hardening polish: WEB-MFA-UI + ACF-014 OpenAPI

- Web: login/Auth0 MFA challenge + Admin Settings TOTP enroll/disable (ACF-001); no payments.
- OpenAPI: `acf-014-notifications-sms.openapi.yaml` + ACF index rows for 013/014.
- OPS-001: MFA-HARD staging flip checklist after privileged enrollment.

## 2026-08-09 - ID-003-OPS clear unverified-email lab flag

- Removed `AUTH0_ALLOW_UNVERIFIED_EMAIL_LINK` from staging after linked-sub smoke re-pass.

## 2026-08-09 - ID-003-OPS Auth0 staging smoke pass

- Full path: Auth0 ID token → EduCore opaque session for `admin@educore.staging`.
- Lab flag `AUTH0_ALLOW_UNVERIFIED_EMAIL_LINK=1` (Auth0 email_verified=false on DB signup).

## 2026-08-09 - ID-003-OPS Auth0 staging live

- Doppler + Fly: `AUTH_IDP_PROVIDER=auth0` + Auth0 domain/client; ID-003 migration applied; API redeployed.
- Auth0 tenant residual: US (`dev-ght4bps24glm825x`), not EU.

## 2026-08-09 - ID-003-OPS Auth0 staging provision tooling

- Added `ops-stg-provision-auth0.mjs`; Fly secret sync includes Auth0 when enabled.
- Live Auth0 tenant still Owner-created (EU preferred).

## 2026-08-09 - ID-003 Auth0 OIDC → opaque session

- Assertion login on `POST /auth/login` when `AUTH_IDP_PROVIDER=auth0`; maps Auth0 `sub` → `users.external_subject_id`.
- Local password AuthN remains default; MFA path unchanged after IdP proof.

## 2026-08-09 - ID-002 Auth0 OIDC provider selection

- Accepted Auth0 as hosted IdP for future ID-003; local AuthN remains until integrate.
- PAY-OPS still deferred (no ClickPesa keys).

## 2026-08-09 - INFRA-002-CUTOVER Neon staging → Frankfurt

- Created `educore-staging-fra` (`aws-eu-central-1`); Doppler/Fly pointed at EU; migrate + seed + login OK.
- Supersedes INFRA-002 us-east-2 residual; legacy URL in `DATABASE_URL_LEGACY_USEAST2`.

## 2026-08-09 - INFRA-002 staging Neon region residual

- Accepted: keep staging Neon on us-east-2 for now; B-05 Frankfurt remains pilot/production intent.
- Password rotate + Fly health verified earlier same period.

## 2026-08-08 - B-07 D1 restore drill (staging Neon)

- Ephemeral Neon branch clone drill Pass; RTO ~6s; evidence `B-07-restore-drill-2026-08-08.md`.
- Staging Fly API live; admin seed + login smoke earlier same day.

## 2026-08-08 - DSF-KIT-001 + OPS-EXEC status

- Accepted kit-wide Design System Freeze `DSF-KIT-001` (tokens, shells, nav, components, a11y/offline).
- OPS-EXEC blocked: fly/doppler/neon CLIs missing, Docker daemon down; Phase 0 tooling + `npm run ops:prereq` added.

## 2026-08-08 - ID-001 MVP IdP posture

- Accepted Option A: defer external IdP/OIDC; local AuthN + MFA for gated private pilot only.
- Unrestricted/public pilot still requires IdP revisit (`ID-002`+) when triggers fire.

## 2026-08-08 - FLY-DOCKER API image + Fly staging config

- Added `apps/api/Dockerfile`, root `.dockerignore`, `infra/fly/educore-api.staging.toml`.
- `npm run docker:build:api`; OPS-001 Phase D unblocked in-repo (live deploy still Owner).

## 2026-08-08 - OPS-001 staging runbook + Sprint 0 exit note

- Published operator runbook for Fly/Neon/Doppler staging + B-07 D1 (`OPS-001-staging-provision-and-d1.md`).
- Recorded Engineering Sprint 0 exit evidence (`SPRINT0_ENGINEERING_EXIT_NOTE.md`); production still NO GO.

## 2026-08-08 - B-03 Design System Freeze posture

- Accepted Option B: provisional DSF-001…006 only; kit-wide Design System Freeze not accepted.
- Decision `B-03-design-system-freeze-posture.md`; readiness B-03 Closed-provisional (posture locked).

## 2026-08-08 - B-04 lite threat model + B-07 pilot ops stub

- Accepted lite threat model (session/MFA/RLS/support): `B-04-lite-threat-model-session-mfa-rls.md`.
- Accepted pilot SLOs + restore-drill schedule on B-05 topology: `B-07-pilot-slos-restore-drill-schedule.md`.
- Readiness prep: B-04 / B-07 Closed-provisional; production still NO GO (drills + IdP residuals open).

## 2026-08-04 - B-05 MVP hosting / DR / secrets decision

- Accepted provisional topology: Fly.io + Neon + Doppler (Frankfurt); RPO≤24h; RTO≤8h.
- Updated readiness prep (B-05 Closed-provisional); production still NO GO until B-07 + threat/IdP.

## 2026-08-04 - Engineering Readiness re-review prep

- Added `docs/engineering/governance/ENGINEERING_READINESS_REREVIEW_PREP_2026-08-04.md`.
- Maps B-01…B-07 against lab progress; **production still NO GO**; next close-outs B-05 / threat model / B-07.

## 2026-08-04 - MFA-HARD continuous privileged enforce

- Login fail-closed when MFA store down under `MFA_ENFORCE=hard`.
- Continuous TOTP gate on privileged `RequirePermission` routes (`finance.manage` / `tenant.manage` / `role.manage`).
- Soft default unchanged; enroll under soft then flip to hard.

## 2026-08-04 - AI-006 OpenAI provider adapter (env-gated)

- Decision Accepted: OpenAI Chat Completions behind `AiProviderPort`; Fake remains default.
- Missing `OPENAI_API_KEY` when `AI_PROVIDER=openai` → 501 / `provider_not_configured` (no silent Fake).
- Added `npm run ai:check-config`; updated Known Limitations / project status.

## 2026-08-04 - AI-005 Fake evaluation harness

- Spec `AI_EVAL_HARNESS.md` + fixture runner for `lab.echo` (happy / failure / redaction / gate / cap).
- EPIC-AI-01 default path complete (AI-001…005); real provider still deferred (AI-006).
- Updated `43_PROJECT_STATUS.md`, `46_KNOWN_LIMITATIONS.md`, `00_START_HERE.md`.

## 2026-08-03 - AI-003 prompt registry polish

- Immutability trigger + `ai_publish_system_prompt_version`; lab catalog + filtered `GET /api/v1/ai/prompts`.
- Updated `43_PROJECT_STATUS.md`, `EPIC-AI-01-plan.md`.

## 2026-08-03 - AI-002 AI Gateway skeleton (Fake)

- Nest `ai-gateway/` with Fake provider, kill switch, feature gate (`lab.echo`), metering, lab HTTP.
- Migration `20260803160000_ai_gateway_create`; permissions `ai.read` / `ai.manage`.
- Updated `43_PROJECT_STATUS.md`, `46_KNOWN_LIMITATIONS.md`, `00_START_HERE.md`.

## 2026-08-03 - MFA-002…005 TOTP lab path

- `mfa_factors` / challenges migration; enroll HTTP; login MFA challenge + verify; `/auth/me` honesty flags.
- Soft `MFA_ENFORCE` default; encryption key required for enroll/verify.

## 2026-08-03 - MFA-001 privileged TOTP Accepted

- Decision: TOTP-only MFA lab path; soft enforce default; IdP/OIDC still deferred.
- Next: MFA-002…005 schema, enroll, login challenge, me honesty.

## 2026-08-03 - COMMS-005 delivery ledger + meter

- Cursor/filter deliveries; usage meter API; segment estimate; lab daily-cap bypass; ACF-014 v1.1.
- EPIC-COMMS-01 lab path COMMS-001…005 complete (live Beem still optional/operator).

## 2026-08-03 - COMMS-004 Beem SMS adapter

- Env-gated Beem client (Fake default); DLR webhook via shared secret; `sms:check-config`.
- Next: COMMS-005 harden meter/list evidence + manual QA.

## 2026-08-03 - COMMS-003 Fake SMS notification path

- Migration + Nest request/delivery APIs with FakeSmsProvider default.
- Next: COMMS-004 Beem adapter behind env secrets.

## 2026-08-03 - COMMS DBF-013 / ACF-014 freezes

- Provisional notifications/SMS schema + API freeze; minimal outbox; next COMMS-003 Fake path.

## 2026-08-03 - COMMS-001 Accepted + COMMS-002 templates

- Owner accepted Beem Africa as MVP SMS provider (Fake CI default).
- Added SMS template catalog v0.1 (en/sw); next = DBF-013 / ACF-014.

## 2026-08-03 - COMMS-001 SMS provider Proposed (Beem)

- Decision brief: Beem Africa for TZ/Zanzibar SMS MVP; Fake CI default; Africa’s Talking fallback.
- Awaiting Owner accept before COMMS-003/004 vendor coding.
- PAY-OPS-001 remains deferred.

## 2026-08-03 - PAY-OPS-001 sandbox deferred

- Operator skipped ClickPesa sandbox until vendor keys exist; next epic = EPIC-COMMS.
- `payments:check-config` remains available for when keys arrive.

## 2026-08-02 - PAY-OPS-001 sandbox config check

- Added `npm run payments:check-config` (redacted ClickPesa readiness report).
- Kit path A locked; operator runbook updated with webhook optional path.

## 2026-08-02 - PAY-006 payment status UI

- Bursar invoice detail: pending MoMo + BillPay + Refresh from provider; Request mobile money with Fake honesty.
- Fees hub: Sync pending (tenant); DSF-004 rev 1.5.
- Next: pilot secrets/ops or EPIC-COMMS (not silent dual scope).

## 2026-08-02 - PAY-005 ClickPesa query sync

- Added `POST /payments/{id}/sync-provider` and batch `POST /payments/sync-provider-pending`.
- Reuses webhook ingest helper so ledger never double-posts; Fake returns `NOT_IMPLEMENTED`.
- ACF-012 rev 1.7; next = PAY-006 payment status UI.

## 2026-08-02 - PAY-004 ClickPesa webhook + mobile-money HTTP

- Added pending MoMo attempt helpers + ClickPesa webhook ingest migration.
- Shipped `POST /payments/mobile-money` and public checksum webhook.
- ACF-012 rev 1.6; next = PAY-005 reconcile job.

## 2026-07-31 - PAY-003 ClickPesa provider client

- Implemented ClickPesa Order BillPay client + `PAYMENT_PROVIDER_PORT` binding (Fake default).
- Unit tests with mocked HTTP; `.env.example` placeholders.
- Next: PAY-004 webhook + mobile-money initiate routes.

## 2026-07-31 - PAY-002 ClickPesa adapter contract

- Accepted PAY-002: Order BillPay initiate, HMAC-SHA256 webhook checksum, status/amount maps, env allowlist.
- Preview ACF-012.x routes; next = PAY-003 implementation (Fake default).
- Updated project status expected next step.

## 2026-07-31 - PAY-001 Accepted (ClickPesa / Zanzibar)

- Accepted PAY-001: Option A aggregator **ClickPesa** for Zanzibar MVP (M-Pesa + Mixx rails; Selcom fallback).
- Amended `PAY-PROVIDER-001`; Fake remains CI/default until adapter + secrets.
- Next milestone: **PAY-002** adapter contract.
- Updated `43_PROJECT_STATUS.md`, `46_KNOWN_LIMITATIONS.md`, `00_START_HERE.md`.

## 2026-07-31 - Project status sync (post Admin UI polish)

- Updated `43_PROJECT_STATUS.md` to controlled MVP vertical-slice phase (lab), reflecting executed Engineering Sprint 0, slice freezes under SOLO-GOV-001, and closed Admin UI polish.
- Updated `00_START_HERE.md` current phase and expected next step (PAY-001 / EPIC-PAY-01).
- Updated `46_KNOWN_LIMITATIONS.md` so limitations match slice freezes + Fake-only payments + MFA/offline residuals.
- Updated `KIT_INDEX.md` recommended AI start prompt to stop implying “Sprint 0 only.”
- Next milestone recorded as MVP payment provider decision (not another Admin UI wave). Does **not** change Architecture Freeze v1.0 or flip readiness to production GO.

## 2026-07-13 - AI Development Kit v2.0 Documentation Control Upgrade

- Added `00_START_HERE.md` as mandatory onboarding and execution gate.
- Added Master Engineering Execution Prompt and AI Engineering Operating System.
- Added Engineering Readiness Review with NO GO production-feature verdict and blockers.
- Added project status, Definition of Ready, technical debt policy, known limitations, document control register, and documentation audit report.
- Clarified current phase, Sprint naming, authority order, canonical architecture/SRS use, and AI onboarding paths.

## 2026-07-12 - Architecture Freeze v1.0

- Consolidated SRS and Project Architecture.
- Completed architecture validation, final review, and Architecture Freeze v1.0.
- Established downstream Database, API Contract, and Design System freeze gates.