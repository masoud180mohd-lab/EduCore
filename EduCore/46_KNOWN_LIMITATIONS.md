# 46 Known Limitations And Deferred Decisions

## Purpose

This document prevents engineers and AI agents from mistaking intentional deferral for permission to improvise.

## Current Limitations

| Area | Current Limitation Or Deferral | Rule |
|---|---|---|
| Production readiness | No unrestricted production feature development approval | Follow `42_ENGINEERING_READINESS_REVIEW.md` blockers |
| Database | No frozen ERD, schema, RLS policy set, index plan, or migration baseline | Complete Database Freeze before persistence work |
| API | No frozen OpenAPI contracts or endpoint payloads | Complete API Contract Freeze before business API/client work |
| Design | No frozen design tokens, navigation, components, states, or accessibility implementation | Complete Design System Freeze before production UI |
| Identity | OIDC/custom provider and session implementation not chosen | Record decision and threat model before identity work |
| Infrastructure | Hosting, region, IaC, secrets provider, RPO/RTO, and DR operations not chosen | Record deployment/DR decision before production deployment |
| Payments | Primary provider/sandbox contract not chosen | Use provider adapter decision and reconciliation specification before payment build |
| AI | Provider/model, evaluation thresholds, and fallback UX not chosen | No AI feature until AI release gate exists |
| Scale | Active-active multi-region and 10 million-user architecture are out of MVP | Do not design for them without a later ADR |
| Product scope | HR/payroll, advanced inventory, transport GPS, advanced hostel, marketplace, white-label, and high-risk AI are deferred | Do not add them to MVP tasks |

## How To Resolve A Limitation

Create the required design/freeze artifact or ADR, assess affected domains, update this document and `43_PROJECT_STATUS.md`, and obtain the relevant approval. A limitation does not disappear because a task is urgent.