# Implementation Plan: M9 Pilot Hardening

## Overview

Prepare the staging environment for Owner-run gated-pilot UAT without changing
school data, runtime secrets, payment configuration, or public-pilot status.

## Scope and boundaries

- The preflight may only check the public staging API health endpoint and web
  reachability.
- It must not authenticate, create fees, attendance, marks, or payments, and
  must never retrieve or print credentials, tokens, or response bodies.
- Owner remains responsible for M9-002 workflow UAT, M9-003 secrets rotation,
  M9-004 latency sampling, and any cutover decision.

## Tasks

### Slice 1: Staging preflight

- [x] Implement `scripts/ops-stg-m9-uat.mjs` as a non-destructive preflight.
- [x] Add a structural test for the safety contract.
- [x] Verify the script syntax and focused test.

### Slice 2: Owner UAT evidence

- [x] Run the preflight against staging (2026-08-26; API and web HTTP 200).
- [ ] Owner completes `docs/engineering/qa/M9-uat-core-workflows.md`.
- [ ] Save the completed result as `M9-uat-staging-YYYY-MM-DD.md`.

### Slice 3: Remaining M9 operations

- [ ] Schedule and perform the non-production D3 secret-rotation rehearsal.
- [ ] Capture a light-load authenticated-read p95 baseline.
- [ ] Apply the M9 cutover checklist only after all critical UAT rows pass.

## Verification checkpoint

- [x] `npm test -- tests/tooling/ops-m9-preflight.test.ts` passes.
- [ ] Preflight evidence has no secrets, tokens, emails, IDs, or response body.
- [ ] No cutover, credential rotation, or data-changing workflow is automated.

## Risks

| Risk                                       | Mitigation                                                    |
| ------------------------------------------ | ------------------------------------------------------------- |
| Automation could be mistaken for UAT       | Emit and document it explicitly as preflight only.            |
| Sensitive response data enters evidence    | Store only endpoint host, HTTP status, timing, and Pass/Fail. |
| Staging is healthy but core workflow fails | Owner executes the existing manual critical-path UAT.         |
