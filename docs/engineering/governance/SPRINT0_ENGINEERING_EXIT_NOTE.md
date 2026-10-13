# Engineering Sprint 0 — Exit evidence note

| Field       | Value                                                          |
| ----------- | -------------------------------------------------------------- |
| Document ID | `SPRINT0-ENG-EXIT-2026-08-08`                                  |
| Against     | `EduCore/roadmap/sprint0_engineering_foundation.md`            |
| Date        | 2026-08-08                                                     |
| Status      | **Exit recorded (honest / partial)** — not Board production GO |
| Authority   | Solo-operator provisional (SOLO-GOV-001)                       |

## Purpose

Satisfy the readiness re-review gate item “Sprint 0 exit evidence” with a short, honest checklist. This is **not** an Engineering Readiness Review verdict and does **not** authorize unrestricted production.

## Exit checklist (as-built)

| Workstream                    | Status                | Evidence (examples)                                                                   | Residual                                   |
| ----------------------------- | --------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------ |
| Repository / workspace        | **Met**               | Monorepo `apps/*`, `packages/*`; `npm run boundaries:check`                           | —                                          |
| Code quality                  | **Met**               | `npm run check` (format, lint, typecheck, test); `.github/workflows/quality-gate.yml` | Branch-protection / CODEOWNERS proof weak  |
| Environment / secrets         | **Met (lab)**         | `.env.example` names only; `env:check`; Doppler chosen (B-05)                         | Live Doppler sync not proven               |
| Local platform                | **Met**               | Docker Compose local Postgres path; `docs/engineering/development-environment.md`     | —                                          |
| CI/CD baseline                | **Mostly**            | Quality gate on PR/push                                                               | Staging deploy pipeline not wired          |
| Test foundation               | **Met**               | Unit + isolation tests under `tests/isolation/`                                       | Live-DB tests env-dependent                |
| Logging / errors              | **Met**               | Correlation ID, error envelope, fail-closed logs                                      | Full tracing stack deferred                |
| Config / flags                | **Partial**           | Typed app config; AI/payment/SMS provider flags                                       | Formal flag expiry registry thin           |
| Health / observability        | **Partial**           | `/health`, engineering status page; B-07 SLOs named                                   | Dashboards / paging not live               |
| Identity skeleton → lab AuthN | **Exceeded Sprint 0** | Opaque sessions, MFA soft/hard (lab)                                                  | IdP/OIDC still open (B-04 residual)        |
| Authorization                 | **Met / exceeded**    | `RequirePermission`, membership-aware source                                          | —                                          |
| Tenant / RLS                  | **Exceeded (slice)**  | RLS + session↔tenant bind; DBF slices                                                 | Kit-wide single ERD freeze open            |
| API foundation                | **Exceeded (slice)**  | Versioned `/api/v1`, ACF slices                                                       | Not every future route frozen              |
| Data tooling                  | **Met / exceeded**    | Migrations + seeds; B-05/B-07 DR posture                                              | Restore **evidence** not yet run           |
| Design foundation             | **Partial**           | Provisional DSF-001…006 (B-03 posture)                                                | Kit-wide Design System Freeze not accepted |
| Documentation portal          | **Met**               | `EduCore/00_START_HERE.md`, decisions/, task-records/, runbooks/                      | —                                          |

## Explicit Sprint 0 non-goal honesty

Sprint 0 forbade business features. The repo has since shipped **gated IMP slices** under SOLO-GOV-001. That work is **out of Sprint 0 scope** but does not erase Sprint 0 foundation exit — it sits **after** foundation under slice freezes.

## Verdict

| Claim                                                    | Result                               |
| -------------------------------------------------------- | ------------------------------------ |
| Engineering Sprint 0 foundation usable for gated lab IMP | **Yes (provisional)**                |
| Unrestricted production / public pilot                   | **Still NO GO** (see readiness prep) |

## Related

- `docs/engineering/governance/ENGINEERING_READINESS_REREVIEW_PREP_2026-08-04.md`
- `docs/engineering/runbooks/OPS-001-staging-provision-and-d1.md`
