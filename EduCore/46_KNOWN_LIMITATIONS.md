# 46 Known Limitations And Deferred Decisions

## Purpose

This document prevents engineers and AI agents from mistaking intentional deferral for permission to improvise.

## Current Limitations

| Area | Current Limitation Or Deferral | Rule |
|---|---|---|
| Production readiness | Independent review remains **NO GO** for unrestricted production / public pilot; **2026-08-04 re-review prep** maps B-01…B-07 progress | Follow `42_ENGINEERING_READINESS_REVIEW.md` + `docs/engineering/governance/ENGINEERING_READINESS_REREVIEW_PREP_2026-08-04.md`; do not claim production readiness from lab IMP alone |
| Freeze authority | Slice freezes Accepted under **SOLO-GOV-001** (acting seats), not independent multi-person countersign | Always qualify freeze language; do not invent “three independent signers” |
| Database | Slice DBF artifacts exist under `docs/engineering/database-freeze/`; **kit-wide** ERD/index/RLS pack is not a single Accepted Freeze v1.0 document | New tables require a DBF revision for that slice before persistence work |
| API | Slice ACF / OpenAPI baselines exist; not every future product route is open | New endpoints require ACF revision + IMP gate |
| Design | **B-03 posture:** provisional DSF-001…006 only; kit-wide Design System Freeze **not** accepted | Stay inside provisional DSF; new screens need new/amended DSF; kit-wide = future `GO DSF-KIT` |
| Identity | Lab opaque-session AuthN + **TOTP MFA** (soft default; **hard continuous gate** available) | Set `MFA_TOTP_ENCRYPTION_KEY`; `MFA_ENFORCE=hard` for privileged production trust; enroll under soft first |
| Infrastructure | **B-05 provisional** + **FLY-DOCKER** artifacts (`apps/api/Dockerfile`, Fly staging toml); live accounts not done | Owner: OPS-001 deploy; no secrets in repo |
| Operations | **B-07 provisional** + **OPS-001 runbook** published; drills not executed | Execute OPS-001 → D1 evidence; multi-person on-call still open |
| Security / identity | **B-04 lite TM** Accepted; sessions + TOTP + MFA-HARD; IdP/OIDC deferred | `MFA_ENFORCE=hard` before pilot finance trust; IdP before unrestricted pilot |
| Payments | **ClickPesa PAY-006 UI shipped**; sandbox pilot **deferred** (no keys yet); runtime **Fake** | No secrets in git; resume PAY-OPS-001 when vendor sandbox available; parent pay still out |
| SMS / notifications | **COMMS-001…005 lab complete** (Fake default; Beem env-gated) | Migrate; optional Beem keys; WhatsApp later |

| Offline | Attendance offline foundation/docs path; 72h offline teacher cutover not production-proven | Do not claim offline MVP complete without worker + conflict UX evidence |
| AI | **EPIC-AI-01 + AI-006 Done** (Fake default; optional OpenAI via env); product AI still gate-blocked; production DPA/residency open | `AI_PROVIDER=fake` default; `openai` needs `OPENAI_API_KEY` (never silent Fake); call via `AiGatewayPort` only; `npm run ai:check-config` |
| Scale | Active-active multi-region and 10 million-user architecture are out of MVP | Do not design for them without a later ADR |
| Product scope | HR/payroll, advanced inventory, transport GPS, advanced hostel, marketplace, white-label, and high-risk AI are deferred | Do not add them to MVP tasks |

## How To Resolve A Limitation

Create the required design/freeze artifact or ADR, assess affected domains, update this document and `43_PROJECT_STATUS.md`, and obtain the relevant approval. A limitation does not disappear because a task is urgent.
