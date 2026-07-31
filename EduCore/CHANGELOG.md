# Changelog

All material documentation changes are recorded here. This changelog does not replace ADRs or freeze records.

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