# M9-001 — Pilot readiness pack (cutover + incident + UAT)

| Field     | Value                                                              |
| --------- | ------------------------------------------------------------------ |
| Date      | 2026-08-21                                                         |
| Program   | **M9** Pilot hardening (Phase 3)                                   |
| Status    | **Done** (docs pack) — gated school cutover still Owner decision   |
| Authority | SOLO-GOV-002                                                       |
| Depends   | B-07 SLOs/drills · MFA-HARD · PAY-007 office path · OPS-PROD infra |

## Objective

Close the first M9 gap: Owner can decide gated-school cutover using written checklists, not memory — without claiming public pilot GO or ClickPesa.

## Delivered

1. [`docs/engineering/runbooks/M9-pilot-cutover-checklist.md`](../runbooks/M9-pilot-cutover-checklist.md) — preconditions, NO-GO, Owner decision block.
2. [`docs/engineering/runbooks/M9-incident-response-solo.md`](../runbooks/M9-incident-response-solo.md) — B-07 alert → action + rollback cheatsheet.
3. [`docs/engineering/qa/M9-uat-core-workflows.md`](../qa/M9-uat-core-workflows.md) — UAT for auth/MFA, office fees, teacher online, honesty checks.
4. Status sync: `EduCore/43_PROJECT_STATUS.md` Next Milestone → M9 in progress.

## Explicit non-goals

- Executing UAT on staging/prod in this slice (Owner runs script when ready)
- D3 secrets rotate rehearsal (scheduled B-07; separate slice)
- WEB-MFA-UI code changes
- PAY-OPS / Beem / offline attendance
- Multi-person on-call
- Public-school unrestricted GO

## Next M9 slices (suggested)

| ID         | Work                                                                           |
| ---------- | ------------------------------------------------------------------------------ |
| **M9-002** | Owner runs UAT on staging; file `M9-uat-staging-YYYY-MM-DD.md`                 |
| **M9-003** | B-07 **D3** secrets rotate rehearsal (staging) when due / when Owner schedules |
| **M9-004** | p95 latency baseline sample under light load (SLO-3 evidence)                  |
| **M9-005** | Optional: WEB-MFA-UI residual polish if enroll UX gaps remain                  |

## Honesty

Pack existence ≠ pilot school live. Production remains gated; Mixx/M-Pesa not live.
