# 46 Known Limitations And Deferred Decisions

## Purpose

This document prevents engineers and AI agents from mistaking intentional deferral for permission to improvise.

## Current Limitations

| Area | Current Limitation Or Deferral | Rule |
|---|---|---|
| Production readiness | Independent review remains **NO GO** for unrestricted production / public pilot | Follow `42_ENGINEERING_READINESS_REVIEW.md`; do not claim production readiness from lab IMP alone |
| Freeze authority | Slice freezes Accepted under **SOLO-GOV-001** (acting seats), not independent multi-person countersign | Always qualify freeze language; do not invent “three independent signers” |
| Database | Slice DBF artifacts exist under `docs/engineering/database-freeze/`; **kit-wide** ERD/index/RLS pack is not a single Accepted Freeze v1.0 document | New tables require a DBF revision for that slice before persistence work |
| API | Slice ACF / OpenAPI baselines exist; not every future product route is open | New endpoints require ACF revision + IMP gate |
| Design | Provisional DSF-001…006 only; **kit-wide Design System Freeze not accepted** | Stay inside provisional DSF; no Tailwind/shadcn redesign without DSF amend |
| Identity | Lab opaque-session AuthN + **TOTP MFA lab** (soft enforce); production OIDC/IdP not done | Set `MFA_TOTP_ENCRYPTION_KEY`; `MFA_ENFORCE=hard` before production privileged trust |
| Infrastructure | Hosting, region, IaC, secrets provider, RPO/RTO, and DR operations not chosen | Record deployment/DR decision before production deployment |
| Payments | **ClickPesa PAY-006 UI shipped**; sandbox pilot **deferred** (no keys yet); runtime **Fake** | No secrets in git; resume PAY-OPS-001 when vendor sandbox available; parent pay still out |
| SMS / notifications | **COMMS-001…005 lab complete** (Fake default; Beem env-gated) | Migrate; optional Beem keys; WhatsApp later |

| Offline | Attendance offline foundation/docs path; 72h offline teacher cutover not production-proven | Do not claim offline MVP complete without worker + conflict UX evidence |
| AI | **AI Gateway + prompt registry + usage metering Done** (Fake / `lab.echo`); real provider & product AI deferred | Migrate through `20260803170000_ai_prompt_registry`; call via `AiGatewayPort` only (ADR-003); caps via `AI_DAILY_CAP_PER_TENANT` / `AI_BYPASS_DAILY_CAP`; no direct LLM calls |
| Scale | Active-active multi-region and 10 million-user architecture are out of MVP | Do not design for them without a later ADR |
| Product scope | HR/payroll, advanced inventory, transport GPS, advanced hostel, marketplace, white-label, and high-risk AI are deferred | Do not add them to MVP tasks |

## How To Resolve A Limitation

Create the required design/freeze artifact or ADR, assess affected domains, update this document and `43_PROJECT_STATUS.md`, and obtain the relevant approval. A limitation does not disappear because a task is urgent.
