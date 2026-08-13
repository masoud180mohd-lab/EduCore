# 46 Known Limitations And Deferred Decisions

## Purpose

This document prevents engineers and AI agents from mistaking intentional deferral for permission to improvise.

## Current Limitations

| Area | Current Limitation Or Deferral | Rule |
|---|---|---|
| Production readiness | Independent review remains **NO GO** for unrestricted production / public pilot. Staging lab MVP is live (FRA). **2026-08-13** kit sync + `ENGINEERING_READINESS_REREVIEW_PREP_2026-08-04.md` | Follow `42_ENGINEERING_READINESS_REVIEW.md`; do not claim production readiness from lab IMP or SOLO-GOV-001 |
| Freeze authority | Slice freezes Accepted under **SOLO-GOV-001** (acting seats), not independent multi-person countersign | Always qualify freeze language; do not invent “three independent signers” |
| Database | Slice DBF artifacts exist under `docs/engineering/database-freeze/`; **kit-wide** ERD/index/RLS pack is not a single Accepted Freeze v1.0 document | New tables require a DBF revision for that slice before persistence work |
| API | Slice ACF / OpenAPI baselines exist; not every future product route is open | New endpoints require ACF revision + IMP gate |
| Design | **DSF-KIT-001** Accepted (kit chrome); slice DSF-001…006 for screens | Cite kit + slice DSF for UI IMP; independent design countersign still open |
| Infrastructure | **B-05** Fly `fra` + Neon **Frankfurt** (`educore-staging-fra`, INFRA-002-CUTOVER Done); Doppler secrets | Legacy us-east-2 project optional delete; no secrets in repo |
| Operations | **B-07** D1 Pass on FRA; **D2** (app redeploy) and weekly PITR glance still Owner | Multi-person on-call still open; production Fly/Neon not provisioned |
| Security / identity | **WEB-AUTH0** US residual; **WEB-MFA-UI**; staging **MFA_ENFORCE=hard** | Auth0 EU cutover cancelled (tenant limit); password AuthN still available |
| Identity | Opaque session + TOTP; privileged path **hard** on staging | Rollback: Doppler `MFA_ENFORCE=soft` + Fly sync |
| Payments | **ClickPesa PAY-006 UI shipped**; sandbox pilot **deferred** (no keys yet); runtime **Fake** | No secrets in git; resume PAY-OPS-001 when vendor sandbox available; parent pay still out |
| SMS / notifications | **COMMS-001…005 lab complete** (Fake default; Beem env-gated) | Migrate; optional Beem keys; WhatsApp later |

| Offline | Attendance offline foundation/docs path; 72h offline teacher cutover not production-proven | Do not claim offline MVP complete without worker + conflict UX evidence |
| AI | **EPIC-AI-01 + AI-006 Done** (Fake default; optional OpenAI via env); product AI still gate-blocked; production DPA/residency open | `AI_PROVIDER=fake` default; `openai` needs `OPENAI_API_KEY` (never silent Fake); call via `AiGatewayPort` only; `npm run ai:check-config` |
| Scale | Active-active multi-region and 10 million-user architecture are out of MVP | Do not design for them without a later ADR |
| Product scope | HR/payroll, advanced inventory, transport GPS, advanced hostel, marketplace, white-label, and high-risk AI are deferred | Do not add them to MVP tasks |

## How To Resolve A Limitation

Create the required design/freeze artifact or ADR, assess affected domains, update this document and `43_PROJECT_STATUS.md`, and obtain the relevant approval. A limitation does not disappear because a task is urgent.
