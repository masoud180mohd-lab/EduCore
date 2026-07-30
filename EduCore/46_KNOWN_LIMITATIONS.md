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
| Identity | Lab opaque-session AuthN exists; production OIDC/IdP and **MFA** for privileged/finance admins not done | Constitution still requires MFA before production privileged finance trust |
| Infrastructure | Hosting, region, IaC, secrets provider, RPO/RTO, and DR operations not chosen | Record deployment/DR decision before production deployment |
| Payments | **FakePaymentProvider only** (`PAY-PROVIDER-001`); real MoMo vendor/sandbox not chosen | No vendor SDK/credentials until PAY-001 supersedes; ledger + reconciliation still mandatory |
| Offline | Attendance offline foundation/docs path; 72h offline teacher cutover not production-proven | Do not claim offline MVP complete without worker + conflict UX evidence |
| AI | Provider/model, evaluation thresholds, and fallback UX not chosen | No AI feature until AI release gate exists; route via AI Gateway rules |
| Scale | Active-active multi-region and 10 million-user architecture are out of MVP | Do not design for them without a later ADR |
| Product scope | HR/payroll, advanced inventory, transport GPS, advanced hostel, marketplace, white-label, and high-risk AI are deferred | Do not add them to MVP tasks |

## How To Resolve A Limitation

Create the required design/freeze artifact or ADR, assess affected domains, update this document and `43_PROJECT_STATUS.md`, and obtain the relevant approval. A limitation does not disappear because a task is urgent.
