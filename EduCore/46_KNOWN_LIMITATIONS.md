# 46 Known Limitations And Deferred Decisions

## Purpose

This document prevents engineers and AI agents from mistaking intentional deferral for permission to improvise.

## Current Limitations

| Area | Current Limitation Or Deferral | Rule |
|---|---|---|
| Production readiness | Staging lab MVP live (FRA). Prod Fly `educore-api` + `educore-web` infra-live. Public-school cutover is **Owner** decision. `42` is a historical checklist (SOLO-GOV-002). | Do not claim Mixx/M-Pesa works; office collection is the live path (PAY-007); `/health` NODE_ENV is not a cutover |
| Freeze authority | Slice freezes are **Owner-accepted** (SOLO-GOV-002). Independent Board / named architect seats are retired | Do not invent three independent signers; do not wait for them |
| Database | Slice DBF artifacts exist under `docs/engineering/database-freeze/`; **kit-wide** ERD/index/RLS pack is not a single Accepted Freeze v1.0 document | New tables require a DBF revision for that slice before persistence work |
| API | Slice ACF / OpenAPI baselines exist; not every future product route is open | New endpoints require ACF revision + IMP gate |
| Design | **DSF-KIT-001** Accepted (kit chrome); slice DSF-001…006 for screens | Cite kit + slice DSF for UI IMP |
| Infrastructure | **B-05** Fly `fra` + Neon Frankfurt (API + **web** staging/prod); Doppler `stg`+`prd` | Infra-live ≠ public-school cutover; no secrets in repo; no custom domain yet |
| Operations | **B-07** D1 Pass + D2 Pass (app redeploy); weekly PITR glance 2026-08-13 (plan max **6h**) | Owner is on-call; 7-day PITR needs Neon plan upgrade |
| Security / identity | **WEB-AUTH0** US residual; **WEB-MFA-UI**; staging **and prod** `MFA_ENFORCE=hard` | Auth0 EU cutover cancelled (tenant limit); password AuthN still available |
| Identity | Opaque session + TOTP; privileged path **hard** on staging and prod | Rollback: Doppler `MFA_ENFORCE=soft` + Fly sync |
| Freeze re-sign | F-005 **withdrawn** (SOLO-GOV-002) | No independent humans to convene |
| Payments | **Live path: office cash/bank/cheque (PAY-007).** ClickPesa remains chosen MoMo for later; runtime Fake; no keys | No secrets in git/chat; do not switch to another paid aggregator to dodge KYC; parent MoMo still out |
| SMS / notifications | **COMMS-001…005 lab complete** (Fake default; Beem env-gated) | Migrate; optional Beem keys; WhatsApp later |

| Offline | Attendance offline foundation/docs path; 72h offline teacher cutover not production-proven | Do not claim offline MVP complete without worker + conflict UX evidence |
| AI | **EPIC-AI-01 + AI-006 Done** (Fake default; optional OpenAI via env); product AI still gate-blocked; production DPA/residency open | `AI_PROVIDER=fake` default; `openai` needs `OPENAI_API_KEY` (never silent Fake); call via `AiGatewayPort` only; `npm run ai:check-config` |
| Scale | Active-active multi-region and 10 million-user architecture are out of MVP | Do not design for them without a later ADR |
| Product scope | HR/payroll, advanced inventory, transport GPS, advanced hostel, marketplace, white-label, and high-risk AI are deferred | Do not add them to MVP tasks |

## How To Resolve A Limitation

Create the required design/freeze artifact or ADR, assess affected domains, update this document and `43_PROJECT_STATUS.md`, and obtain the relevant approval. A limitation does not disappear because a task is urgent.
