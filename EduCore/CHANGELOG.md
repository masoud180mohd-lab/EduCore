# Changelog

All material documentation changes are recorded here. This changelog does not replace ADRs or freeze records.

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