# 39 Engineering Execution Roadmap

## Document Purpose

This document transforms EduCore Architecture Freeze v1.0 into an executable engineering roadmap.

It is written for engineering leadership, product leadership, TPMs, developers, QA, DevOps, security, and AI agents.

No production code, database schema, API payloads, or UI implementation is defined here. This is execution planning after architecture freeze and before implementation.

## Source Of Truth

This plan uses the EduCore AI Development Kit v2.0 as the only source of truth, especially:

- `03_DEVELOPMENT_CONSTITUTION.md`
- `34_SOFTWARE_REQUIREMENTS_SPECIFICATION.md`
- `35_PROJECT_ARCHITECTURE.md`
- `38_ARCHITECTURE_FREEZE_RECORD.md`
- ADRs in `decisions/`
- domain bible documents.

## Executive Summary

Architecture is frozen for downstream design, but implementation is not yet approved.

Before coding begins, the project must complete:

1. Database Design Freeze.
2. API Contract Freeze.
3. Design System Freeze.

The engineering roadmap therefore starts with freeze gates, then foundation workstreams, then MVP feature slices, then pilot hardening, then public beta and GA.

## Engineering Readiness Score

Current score: 78/100.

Why not higher:

- database schema is not frozen.
- API contracts are not frozen.
- design system implementation baseline is not frozen.
- exact identity provider is open.
- exact payment provider for MVP is open.
- exact infrastructure provider is open.

Why it is strong:

- architecture is frozen.
- MVP scope is narrow.
- critical ADRs exist.
- non-negotiable rules are explicit.
- risk domains are identified.
- development constitution exists.

## Pre-Planning Review

### Missing Implementation Details

| Area | Missing Detail | Resolution Path |
|---|---|---|
| Database | exact tables, ERD, indexes, RLS policies | Sprint 1 Database Freeze |
| API | OpenAPI contracts, request/response payloads, error codes | API Contract Freeze before backend feature work |
| Design | tokens, layouts, core components, role navigation | Design System Freeze before frontend feature work |
| Identity | exact OIDC/custom provider decision | Identity provider spike and ADR update if needed |
| Payments | MVP provider and sandbox contract | Payment provider selection and adapter spec |
| Infrastructure | exact MVP hosting topology | Infrastructure decision record before deploy work |
| Test data | tenant fixtures and school sample datasets | QA foundation workstream |
| Support tooling | exact admin/support workflows | Admin/support workstream |

### Architectural Assumptions

- Modular monolith remains the starting architecture.
- Shared PostgreSQL with RLS is the default tenancy model.
- REST + BFF is the default API strategy.
- GraphQL is deferred.
- Ledger is finance source of truth.
- Offline is workflow-specific, attendance first.
- AI Gateway is required.
- SMS ships before WhatsApp.
- Kubernetes is deferred until operationally justified.

### Technical Risks

- RLS incorrectly applied.
- authorization policy gaps.
- payment webhook duplication or delay.
- ledger imbalance.
- offline sync corruption.
- AI privacy leak.
- weak observability.
- migration churn if database freeze is skipped.

### Dependency Risks

- payment provider sandbox access.
- SMS provider availability.
- identity provider decision.
- infrastructure account setup.
- test data availability.
- product decisions on role permissions.

### Business-Critical Components

1. tenant onboarding.
2. authentication and access control.
3. student registry.
4. attendance.
5. marks and approval.
6. finance ledger.
7. payments and receipts.
8. SMS parent communication.
9. observability and support.

### Implementation Blockers

Coding is blocked until:

- Database Freeze v1.0 exists.
- API Contract Freeze v1.0 exists for the slice.
- Design System Freeze v1.0 exists for frontend slices.
- MVP provider choices for auth/payment/SMS are resolved.

## Program Phases

| Phase | Goal | Exit Criteria |
|---|---|---|
| Phase 0 | Freeze downstream design | database, API, design freeze records accepted |
| Phase 1 | Sprint 0 engineering foundation | workspace, CI, test, config, observability, deny-by-default skeletons, and design tokens ready; no business feature |
| Phase 2 | MVP core domains | tenant, identity, student, academics, attendance, marks, finance, payments, SMS |
| Phase 3 | Pilot hardening | security, performance, DR, support tooling, UAT, pilot readiness |
| Phase 4 | Public beta | stable onboarding, support, monitoring, rollback, docs |
| Phase 5 | GA | operational maturity, SLA posture, compliance readiness |

## Workstreams

### WS-01 Program Governance And Freeze Management

Purpose: keep implementation aligned with architecture freeze and avoid uncontrolled scope.

Business Value: prevents churn, rework, and ambiguous execution.

Dependencies: Architecture Freeze v1.0.

Deliverables:

- execution board.
- sprint plan.
- freeze records.
- decision log.
- dependency tracker.

Risks:

- teams bypass freeze gates.
- hidden dependencies appear late.

Success Criteria:

- no coding starts before required freeze gate.
- every architecture change has ADR.

Complexity: Medium.

Priority: Critical.

### WS-02 Database And Data Governance

Purpose: freeze database design before implementation.

Business Value: prevents weekly schema churn and protects tenant/financial data.

Dependencies: architecture freeze, DDD model, payment bible, offline bible, access control bible.

Deliverables:

- ERD.
- schema specification.
- RLS policy specification.
- indexing and partition plan.
- migration strategy.
- seed/test data strategy.

Risks:

- RLS gaps.
- wrong ledger modeling.
- over-normalization or premature optimization.

Success Criteria:

- Database Freeze v1.0 accepted.
- tenant isolation test matrix approved.

Complexity: Very High.

Priority: Critical.

### WS-03 API Contract And Integration Design

Purpose: freeze API contracts before backend/frontend parallel work.

Business Value: allows teams to work in parallel with minimal blocking.

Dependencies: database freeze draft, product requirements, access control, design system flows.

Deliverables:

- OpenAPI baseline.
- BFF endpoint inventory.
- error contract.
- idempotency rules.
- webhook contract standards.

Risks:

- frontend/backend mismatch.
- authorization missing from endpoint design.

Success Criteria:

- API Contract Freeze v1.0 accepted.
- mock server or contract examples available.

Complexity: High.

Priority: Critical.

### WS-04 Design System And UX Foundation

Purpose: freeze product UX foundations before frontend implementation.

Business Value: reduces UI inconsistency and speeds frontend delivery.

Dependencies: SRS, design system doc, role workflows.

Deliverables:

- design tokens.
- layouts.
- role navigation model.
- core components.
- offline states.
- accessibility baseline.

Risks:

- weak mobile experience.
- common tasks buried in UI.

Success Criteria:

- Design System Freeze v1.0 accepted.
- core workflows can be prototyped.

Complexity: High.

Priority: Critical.

### WS-05 Platform Foundation

Purpose: establish the backend, frontend, repo, build, config, and runtime foundations.

Business Value: creates a stable base for every team.

Dependencies: freeze gates and engineering standards.

Deliverables:

- repository structure.
- NestJS foundation.
- Next.js foundation.
- shared tooling.
- config management.
- logging/tracing skeleton.

Risks:

- poor module boundaries.
- weak DX.

Success Criteria:

- app shells run in local/staging.
- module boundary checks exist.

Complexity: High.

Priority: Critical.

### WS-06 Identity, Authentication, And Sessions

Purpose: provide secure identity and authentication foundation.

Business Value: every workflow depends on trusted user identity.

Dependencies: identity provider decision, API contract, security standards.

Deliverables:

- login.
- session management.
- MFA for privileged users.
- password/reset or OIDC integration.
- device/session visibility.

Risks:

- account takeover.
- weak MFA recovery.

Success Criteria:

- privileged roles require MFA.
- sessions are revocable.

Complexity: High.

Priority: Critical.

### WS-07 Tenant Engine And Organization Management

Purpose: create schools, settings, entitlements, and tenant context.

Business Value: this is the SaaS foundation.

Dependencies: database freeze, auth foundation, RLS.

Deliverables:

- tenant provisioning.
- school profile.
- tenant settings.
- entitlement checks.
- tenant context middleware.

Risks:

- cross-tenant data leakage.
- tenant setup inconsistency.

Success Criteria:

- tenant isolation tests pass.
- tenant provisioning works end to end.

Complexity: Very High.

Priority: Critical.

### WS-08 Authorization And Access Control

Purpose: enforce RBAC, relationship-aware access, ABAC context, delegation, and support access.

Business Value: protects child, staff, and financial data.

Dependencies: identity, tenant engine, access control bible.

Deliverables:

- policy engine/service.
- role catalog.
- relationship checks.
- delegation model.
- support access controls.
- permission golden tests.

Risks:

- over-broad access.
- impossible-to-debug permissions.

Success Criteria:

- parent/teacher/support test cases pass.
- sensitive access is audited.

Complexity: Very High.

Priority: Critical.

### WS-09 Student Registry And Academic Structure

Purpose: support students, guardians, classes, streams, subjects, terms, and assignments.

Business Value: creates the operational academic base.

Dependencies: tenant engine, access control, database freeze.

Deliverables:

- student registry.
- guardian links.
- academic years/terms.
- classes/streams/subjects.
- teacher assignments.

Risks:

- incorrect relationship modeling.
- weak import/onboarding path.

Success Criteria:

- school can configure academic structure and register students.

Complexity: High.

Priority: Critical.

### WS-10 Attendance And Offline Sync

Purpose: deliver first offline-capable teacher workflow.

Business Value: differentiates EduCore in weak internet environments.

Dependencies: student registry, academic structure, auth, access control, offline sync model.

Deliverables:

- attendance capture.
- offline operation queue.
- sync processing.
- conflict visibility.
- audit for corrections.

Risks:

- offline corruption.
- stale permissions.

Success Criteria:

- teacher can capture attendance offline and sync safely.

Complexity: Very High.

Priority: Critical.

### WS-11 Assessment, Marks, And Report Cards

Purpose: support exam setup, marks entry, approval, and basic report cards.

Business Value: core school academic reporting workflow.

Dependencies: academic structure, access control, design system, API contracts.

Deliverables:

- exam setup.
- marks entry.
- marks submission.
- marks approval.
- basic report cards.

Risks:

- marks overwritten incorrectly.
- approval workflow too rigid.

Success Criteria:

- approved marks are locked and report card can be generated.

Complexity: High.

Priority: Critical.

### WS-12 Finance Ledger, Invoicing, And Receipts

Purpose: build safe finance core.

Business Value: payment trust and school cashflow.

Dependencies: database freeze, payment/accounting bible, tenant engine.

Deliverables:

- chart of accounts baseline.
- fee structures.
- invoices.
- journal posting.
- receipts.
- reversals foundation.

Risks:

- ledger imbalance.
- incorrect balances.

Success Criteria:

- every posted financial transaction balances.

Complexity: Very High.

Priority: Critical.

### WS-13 Payment Orchestration And Reconciliation

Purpose: integrate first payment provider safely.

Business Value: enables fee collection and receipts.

Dependencies: finance ledger, provider decision, API contract, observability.

Deliverables:

- provider adapter.
- payment attempts.
- webhook ingestion.
- idempotency.
- reconciliation.
- payment status UI/API.

Risks:

- duplicate webhook.
- delayed provider callbacks.
- amount mismatch.

Success Criteria:

- duplicate/delayed webhook tests pass.
- reconciliation identifies mismatches.

Complexity: Very High.

Priority: Critical.

### WS-14 Communication And Notification Engine

Purpose: send reliable parent notifications, SMS first.

Business Value: parent engagement and school communication.

Dependencies: tenant engine, student/guardian data, notification provider decision.

Deliverables:

- template registry.
- notification request.
- SMS adapter.
- delivery ledger.
- preferences/consent baseline.

Risks:

- notification cost spike.
- delivery failures invisible.

Success Criteria:

- SMS delivery tracked per tenant.

Complexity: High.

Priority: High.

### WS-15 Frontend Web Experience

Purpose: create admin, teacher, finance, and parent web workflows.

Business Value: primary user-facing product.

Dependencies: design system freeze, API contract freeze.

Deliverables:

- login.
- role layouts.
- headmaster dashboard shell.
- teacher attendance UI.
- student registry UI.
- finance/payment UI.
- parent portal basics.

Risks:

- weak mobile responsiveness.
- too many screens before core workflows work.

Success Criteria:

- top five MVP workflows usable on web/mobile browser.

Complexity: High.

Priority: Critical.

### WS-16 Mobile Readiness

Purpose: prepare mobile-first workflows and future React Native app.

Business Value: teachers and parents often operate on phones.

Dependencies: design system, offline sync, API contracts.

Deliverables:

- mobile UX rules.
- offline attendance mobile flow.
- local state strategy.
- React Native foundation in later phase.

Risks:

- duplicating web/mobile offline logic.

Success Criteria:

- attendance flow works well on low-end mobile web; native app plan ready.

Complexity: Medium.

Priority: High.

### WS-17 AI Platform

Purpose: establish safe AI Gateway before AI features.

Business Value: enables future AI without privacy/cost chaos.

Dependencies: AI guidelines, auth, tenant metering, observability.

Deliverables:

- AI Gateway skeleton.
- prompt registry.
- model routing config.
- cost metering.
- privacy filters.
- evaluation harness.

Risks:

- AI privacy leak.
- token cost spike.

Success Criteria:

- low-risk AI requests are metered, logged, and policy-gated.

Complexity: High.

Priority: Medium for MVP, Critical before AI launch.

### WS-18 Observability, SRE, And Support Operations

Purpose: make production workflows measurable and supportable.

Business Value: prevents invisible failures and improves pilot trust.

Dependencies: platform foundation, critical workflows.

Deliverables:

- logs.
- metrics.
- traces.
- dashboards.
- alerts.
- support tools.
- runbooks.

Risks:

- system is up but workflows fail.

Success Criteria:

- payment, sync, notification, login, and API health dashboards exist.

Complexity: High.

Priority: Critical.

### WS-19 Infrastructure, DevOps, And Release Engineering

Purpose: enable safe deployment and repeatable environments.

Business Value: supports continuous delivery and recovery.

Dependencies: platform foundation, deployment guidelines.

Deliverables:

- local/dev/staging/prod environments.
- CI pipeline.
- secrets management.
- backup/restore.
- release process.
- feature flags.

Risks:

- unrecoverable deployment.
- secrets leakage.

Success Criteria:

- staging deploy repeatable.
- restore drill completed.

Complexity: High.

Priority: Critical.

### WS-20 QA, Test Automation, And Documentation

Purpose: institutionalize quality and shared knowledge.

Business Value: reduces regressions and onboarding cost.

Dependencies: all workstreams.

Deliverables:

- test strategy.
- fixtures.
- tenant isolation tests.
- permission golden tests.
- payment replay tests.
- docs.
- user guides.

Risks:

- success-path-only testing.

Success Criteria:

- critical workflows have automated negative/failure tests.

Complexity: High.

Priority: Critical.

## Epic And Feature Breakdown

### EPIC-GOV-01: Execution Governance

Objective: create a controlled delivery system.

Scope: sprint planning, dependency tracking, ADR governance, quality gate enforcement.

Deliverables: delivery board, dependency map, risk register, gate calendar.

Dependencies: Architecture Freeze v1.0.

Risks: teams bypass gates.

Acceptance Criteria:

- all work has workstream owner.
- all blockers are visible.
- no code work starts before required gates.

Estimated Size: Medium.

Priority: Critical.

Features:

- F-GOV-01: Workstream ownership model.
- F-GOV-02: Dependency board.
- F-GOV-03: Freeze gate calendar.

Tasks:

| Task ID | Task | Effort | Skills | Dependencies | Output | Tests | Review |
|---|---|---:|---|---|---|---|---|
| GOV-001 | Create workstream ownership map | 0.5d | TPM | freeze record | owner matrix | n/a | VP Eng |
| GOV-002 | Create dependency board | 1d | TPM | workstreams | dependency tracker | n/a | TPM |
| GOV-003 | Create freeze gate calendar | 0.5d | TPM | roadmap | gate schedule | n/a | CTO/VP Eng |

### EPIC-DB-01: Database Freeze

Objective: freeze database design before implementation.

Scope: ERD, table ownership, RLS, indexing, migration strategy, seed strategy.

Deliverables: Database Freeze v1.0.

Dependencies: architecture freeze, DDD bible, payment bible, offline bible.

Risks: tenant leakage, ledger errors.

Acceptance Criteria:

- every table has owner.
- every tenant-owned table has RLS plan.
- ledger invariants represented.

Estimated Size: Very High.

Priority: Critical.

Features:

- F-DB-01: bounded-context data ownership.
- F-DB-02: tenant/RLS model.
- F-DB-03: ledger/offline/audit/outbox data model.

Tasks:

| Task ID | Task | Effort | Skills | Dependencies | Output | Tests | Review |
|---|---|---:|---|---|---|---|---|
| DB-001 | Map entities to bounded contexts | 1d | Architect, DBA | SRS | ownership matrix | consistency review | Architect |
| DB-002 | Draft ERD | 2d | DBA | DB-001 | ERD draft | model walkthrough | DBA lead |
| DB-003 | Define tenant/RLS policy plan | 1.5d | DBA, Security | DB-002 | RLS spec | cross-tenant test plan | Security |
| DB-004 | Define ledger data model | 2d | DBA, Finance Eng | DB-002 | ledger model | balancing test plan | Finance lead |
| DB-005 | Define offline operation model | 1.5d | Backend, Mobile | DB-002 | sync model | conflict test plan | Offline lead |
| DB-006 | Define migration strategy | 1d | DBA, DevOps | DB-002 | migration plan | rollback review | DevOps |

### EPIC-API-01: API Contract Freeze

Objective: define stable contracts for parallel frontend/backend work.

Scope: REST resources, BFF endpoints, errors, auth, idempotency, webhooks.

Deliverables: API Contract Freeze v1.0.

Dependencies: database freeze draft, access rules, UX workflows.

Risks: contract churn and integration blocking.

Acceptance Criteria:

- every MVP workflow has endpoint contract.
- every sensitive endpoint has auth rule.
- error and idempotency rules are consistent.

Estimated Size: High.

Priority: Critical.

Features:

- F-API-01: REST resource inventory.
- F-API-02: BFF contracts.
- F-API-03: webhook and idempotency contracts.

Tasks:

| Task ID | Task | Effort | Skills | Dependencies | Output | Tests | Review |
|---|---|---:|---|---|---|---|---|
| API-001 | Inventory MVP endpoints | 1d | Backend, Product | SRS | endpoint map | coverage review | API lead |
| API-002 | Define error contract | 0.5d | Backend | API-001 | error standard | contract examples | Backend lead |
| API-003 | Define BFF contracts | 1.5d | Backend, Frontend | UX flows | BFF spec | mock validation | FE/BE leads |
| API-004 | Define idempotency rules | 1d | Backend, Payments | payment/offline reqs | idempotency spec | replay scenarios | Security/Payments |
| API-005 | Define webhook contracts | 1d | Payments | provider choice | webhook spec | duplicate/delay cases | Payments lead |

### EPIC-DS-01: Design System Freeze

Objective: freeze UI foundations before frontend build.

Scope: tokens, layouts, navigation, components, states, accessibility.

Deliverables: Design System Freeze v1.0.

Dependencies: product workflows, role model, SRS.

Risks: inconsistent UX and mobile failures.

Acceptance Criteria:

- role navigation model approved.
- offline states defined.
- core components defined.

Estimated Size: High.

Priority: Critical.

Features:

- F-DS-01: role navigation.
- F-DS-02: component baseline.
- F-DS-03: workflow states.

Tasks:

| Task ID | Task | Effort | Skills | Dependencies | Output | Tests | Review |
|---|---|---:|---|---|---|---|---|
| DS-001 | Define role navigation model | 1d | UX, Product | personas | nav map | workflow review | Product |
| DS-002 | Define tokens and layout rules | 1d | UX | brand direction | token spec | accessibility check | UX lead |
| DS-003 | Define core components | 1.5d | UX, FE | DS-002 | component list | responsive review | FE lead |
| DS-004 | Define offline/error/loading states | 1d | UX, Offline lead | workflows | state spec | usability review | UX/Product |

### EPIC-PLAT-01: Engineering Foundation

Objective: create a production-grade development foundation.

Scope: repo, tooling, local dev, CI, module boundary enforcement.

Deliverables: app skeletons and shared engineering workflows.

Dependencies: freeze gates for relevant slices.

Risks: poor DX and merge conflicts.

Acceptance Criteria:

- local dev works.
- CI runs.
- boundary checks exist.

Estimated Size: High.

Priority: Critical.

Features:

- F-PLAT-01: repo and tooling.
- F-PLAT-02: backend skeleton.
- F-PLAT-03: frontend skeleton.

Tasks:

| Task ID | Task | Effort | Skills | Dependencies | Output | Tests | Review |
|---|---|---:|---|---|---|---|---|
| PLAT-001 | Define repo structure | 0.5d | Tech Lead | constitution | repo map | review | VP Eng |
| PLAT-002 | Configure lint/type/test baseline | 1d | Full-stack | PLAT-001 | tooling config | CI dry run | Tech Lead |
| PLAT-003 | Create backend module skeleton | 1d | Backend | PLAT-001 | NestJS skeleton | unit smoke | Backend lead |
| PLAT-004 | Create frontend app shell | 1d | Frontend | DS freeze | Next.js shell | render smoke | FE lead |
| PLAT-005 | Add module boundary checks | 1d | Backend | PLAT-003 | boundary rules | forbidden import test | Architect |

### EPIC-ID-01: Identity Foundation

Objective: authenticate users securely.

Scope: login, sessions, MFA policy, password/OIDC choice, logout, session revocation.

Deliverables: identity foundation.

Dependencies: provider decision, security standards, API contracts.

Risks: account takeover.

Acceptance Criteria:

- privileged accounts require MFA.
- sessions are revocable.

Estimated Size: High.

Priority: Critical.

Features:

- F-ID-01: identity provider integration.
- F-ID-02: sessions and MFA.
- F-ID-03: account recovery and audit.

Tasks:

| Task ID | Task | Effort | Skills | Dependencies | Output | Tests | Review |
|---|---|---:|---|---|---|---|---|
| ID-001 | Finalize identity provider decision | 1d | Security, Backend | security review | decision note/ADR if needed | threat review | Security |
| ID-002 | Define auth flows | 1d | Backend, UX | ID-001 | auth flow spec | flow review | Product/Security |
| ID-003 | Implement auth contract tests | 1d | QA, Backend | API freeze | test cases | auth tests | QA lead |
| ID-004 | Implement session revocation plan | 1d | Backend | ID-002 | session spec | revocation cases | Security |

### EPIC-TEN-01: Tenant Engine

Objective: create reliable tenant onboarding and context.

Scope: tenant provisioning, school settings, entitlements, tenant context propagation.

Deliverables: tenant engine foundation.

Dependencies: database freeze, auth, RLS.

Risks: cross-tenant leakage.

Acceptance Criteria:

- tenant context is set for every protected request.
- cross-tenant tests fail closed.

Estimated Size: Very High.

Priority: Critical.

Features:

- F-TEN-01: tenant provisioning.
- F-TEN-02: tenant context.
- F-TEN-03: entitlements and settings.

Tasks:

| Task ID | Task | Effort | Skills | Dependencies | Output | Tests | Review |
|---|---|---:|---|---|---|---|---|
| TEN-001 | Define tenant lifecycle states | 0.5d | Product, Backend | SRS | lifecycle spec | review | Product |
| TEN-002 | Implement tenant context middleware | 1.5d | Backend, DBA | RLS plan | tenant context | cross-tenant tests | Security |
| TEN-003 | Implement tenant provisioning workflow | 2d | Backend | DB/API freeze | provisioning service | integration tests | Backend lead |
| TEN-004 | Implement entitlement checks | 1d | Backend | business model | entitlement service | plan tests | Product/Backend |

### EPIC-AUTHZ-01: Policy Authorization

Objective: enforce relationship-aware access.

Scope: roles, policies, relationships, delegations, support access, tests.

Deliverables: authorization foundation.

Dependencies: identity, tenant engine, access control bible.

Risks: data exposure and admin confusion.

Acceptance Criteria:

- golden tests pass for parent, teacher, headmaster, finance, support.

Estimated Size: Very High.

Priority: Critical.

Features:

- F-AUTHZ-01: role and permission catalog.
- F-AUTHZ-02: relationship policy engine.
- F-AUTHZ-03: support/delegation access.

Tasks:

| Task ID | Task | Effort | Skills | Dependencies | Output | Tests | Review |
|---|---|---:|---|---|---|---|---|
| AUTHZ-001 | Define MVP permission matrix | 1.5d | Security, Product | roles | matrix | golden review | Security/Product |
| AUTHZ-002 | Define relationship rules | 1d | Backend, Product | academic model | relationship spec | examples | Architect |
| AUTHZ-003 | Implement policy decision service | 2d | Backend | AUTHZ-001/002 | policy service | unit + integration | Security |
| AUTHZ-004 | Implement golden tests | 1.5d | QA, Backend | AUTHZ-003 | test suite | automated | QA/Security |

### EPIC-ACAD-01: Student And Academic Foundation

Objective: build academic base workflows.

Scope: students, guardians, classes, streams, subjects, teacher assignments.

Deliverables: academic foundation.

Dependencies: tenant, authz, DB/API freeze.

Risks: relationship mistakes.

Acceptance Criteria:

- school can create academic structure and register students.

Estimated Size: High.

Priority: Critical.

Features:

- F-ACAD-01: student registry.
- F-ACAD-02: guardian relationships.
- F-ACAD-03: academic structure.

Tasks:

| Task ID | Task | Effort | Skills | Dependencies | Output | Tests | Review |
|---|---|---:|---|---|---|---|---|
| ACAD-001 | Define academic setup workflow | 1d | Product, UX | SRS | workflow spec | review | Product |
| ACAD-002 | Implement student registry service | 2d | Backend | DB/API freeze | service | tenant/auth tests | Backend lead |
| ACAD-003 | Implement guardian relationship service | 1.5d | Backend | ACAD-002 | relationship service | parent access tests | Security |
| ACAD-004 | Implement academic structure service | 2d | Backend | DB/API freeze | classes/subjects service | integration tests | Backend lead |
| ACAD-005 | Implement student/admin UI | 2d | Frontend | API/design freeze | UI flow | E2E smoke | FE lead |

### EPIC-ATT-01: Attendance And Offline

Objective: deliver attendance including offline-first capture.

Scope: attendance sessions, records, offline operation queue, sync, conflict handling.

Deliverables: attendance workflow.

Dependencies: academic foundation, authz, offline model.

Risks: offline corruption.

Acceptance Criteria:

- teacher can capture attendance offline and sync safely.

Estimated Size: Very High.

Priority: Critical.

Features:

- F-ATT-01: online attendance.
- F-ATT-02: offline operation queue.
- F-ATT-03: sync and conflict handling.

Tasks:

| Task ID | Task | Effort | Skills | Dependencies | Output | Tests | Review |
|---|---|---:|---|---|---|---|---|
| ATT-001 | Define attendance workflow states | 1d | Product, UX, Backend | offline bible | state spec | review | Product |
| ATT-002 | Implement online attendance service | 2d | Backend | ACAD/AUTHZ | service | integration tests | Backend |
| ATT-003 | Implement offline operation contract | 1.5d | Backend, Frontend | API freeze | sync contract | replay tests | Offline lead |
| ATT-004 | Implement local offline queue UI | 2d | Frontend | DS freeze | offline UI | offline E2E | FE lead |
| ATT-005 | Implement sync processor | 2d | Backend | ATT-003 | sync worker | idempotency/conflict tests | Offline/Security |

### EPIC-MARKS-01: Assessment And Reports

Objective: support marks workflow and basic reports.

Scope: exams, marks, submission, approval, report card generation.

Deliverables: assessment foundation.

Dependencies: academic foundation, authz, reporting worker.

Risks: marks integrity failure.

Acceptance Criteria:

- marks can be submitted, approved, locked, and used for report cards.

Estimated Size: High.

Priority: Critical.

Features:

- F-MARKS-01: exam setup.
- F-MARKS-02: marks entry and approval.
- F-MARKS-03: basic report card.

Tasks:

| Task ID | Task | Effort | Skills | Dependencies | Output | Tests | Review |
|---|---|---:|---|---|---|---|---|
| MARKS-001 | Define marks approval policy | 1d | Product, Security | authz | policy spec | policy tests | Product/Security |
| MARKS-002 | Implement exam setup service | 1.5d | Backend | ACAD | exam service | integration tests | Backend |
| MARKS-003 | Implement marks service | 2d | Backend | MARKS-001 | marks service | approval/lock tests | Backend/Security |
| MARKS-004 | Implement marks entry UI | 2d | Frontend | API/design | teacher UI | E2E | FE |
| MARKS-005 | Implement report card worker | 2d | Backend | MARKS-003 | worker | generated output tests | Backend/QA |

### EPIC-FIN-01: Ledger And Invoicing

Objective: implement finance core safely.

Scope: fee structures, invoices, ledger posting, receipts, reversals foundation.

Deliverables: finance foundation.

Dependencies: database freeze, payment/accounting bible.

Risks: financial inconsistency.

Acceptance Criteria:

- every posted transaction balances.
- balances are derived.

Estimated Size: Very High.

Priority: Critical.

Features:

- F-FIN-01: chart and ledger foundation.
- F-FIN-02: invoices and fee structures.
- F-FIN-03: receipts and reversals.

Tasks:

| Task ID | Task | Effort | Skills | Dependencies | Output | Tests | Review |
|---|---|---:|---|---|---|---|---|
| FIN-001 | Define MVP accounting flows | 1.5d | Finance Eng, Product | bible | accounting flow spec | finance review | Finance lead |
| FIN-002 | Implement ledger posting service | 3d | Backend, Finance Eng | DB freeze | ledger service | balancing tests | Finance/Security |
| FIN-003 | Implement fee/invoice service | 2d | Backend | FIN-002 | invoice service | integration tests | Backend |
| FIN-004 | Implement receipt generation service | 1.5d | Backend | FIN-002 | receipt service | receipt tests | Finance |
| FIN-005 | Implement finance UI basics | 2d | Frontend | API/design | finance UI | E2E | FE/Product |

### EPIC-PAY-01: Payment Provider And Reconciliation

Objective: support first payment provider safely.

Scope: payment attempts, adapter, webhook, reconciliation, payment status.

Deliverables: payment MVP.

Dependencies: finance ledger, provider selection, observability.

Risks: duplicate payment, missed webhook, mismatch.

Acceptance Criteria:

- duplicate/delayed webhook tests pass.
- reconciliation identifies mismatches.

Estimated Size: Very High.

Priority: Critical.

Features:

- F-PAY-01: provider adapter.
- F-PAY-02: webhook processing.
- F-PAY-03: reconciliation.

Tasks:

| Task ID | Task | Effort | Skills | Dependencies | Output | Tests | Review |
|---|---|---:|---|---|---|---|---|
| PAY-001 | Select MVP payment provider | 1d | Product, Finance, Backend | business review | decision | n/a | VP Eng/Product |
| PAY-002 | Define provider adapter contract | 1d | Backend | PAY-001 | adapter spec | contract tests | Payments lead |
| PAY-003 | Implement payment attempt lifecycle | 2d | Backend | FIN | payment service | state tests | Payments |
| PAY-004 | Implement webhook ingestion | 2d | Backend, Security | PAY-002 | webhook handler | signature/replay tests | Security |
| PAY-005 | Implement reconciliation job | 2d | Backend, Finance | PAY-003 | reconciliation worker | mismatch tests | Finance |
| PAY-006 | Implement payment status UI | 1.5d | Frontend | API/design | payment UI | E2E | FE |

### EPIC-COMMS-01: SMS Notification Engine

Objective: send and track MVP notifications.

Scope: templates, requests, SMS provider, delivery ledger, preferences.

Deliverables: SMS notification MVP.

Dependencies: student/guardian data, provider selection, outbox.

Risks: cost spike, invisible delivery failure.

Acceptance Criteria:

- delivery status tracked.
- tenant usage metered.

Estimated Size: High.

Priority: High.

Features:

- F-COMMS-01: template and request service.
- F-COMMS-02: SMS adapter.
- F-COMMS-03: delivery ledger and preferences.

Tasks:

| Task ID | Task | Effort | Skills | Dependencies | Output | Tests | Review |
|---|---|---:|---|---|---|---|---|
| COMMS-001 | Select SMS provider | 0.5d | Product, Backend | business model | decision | n/a | Product |
| COMMS-002 | Define notification templates | 1d | Product, UX | workflows | template catalog | content review | Product |
| COMMS-003 | Implement notification request service | 1.5d | Backend | outbox | service | integration tests | Backend |
| COMMS-004 | Implement SMS adapter | 1.5d | Backend | provider | adapter | provider contract tests | Backend |
| COMMS-005 | Implement delivery ledger | 1d | Backend | DB freeze | delivery tracking | status tests | Backend/QA |

### EPIC-AI-01: AI Gateway Foundation

Objective: prepare safe AI platform.

Scope: gateway, prompt registry, model routing, metering, privacy controls, evaluation.

Deliverables: AI foundation, no high-risk AI launch.

Dependencies: tenant metering, authz, observability.

Risks: privacy and cost.

Acceptance Criteria:

- all AI calls are routed through gateway.
- cost is tracked by tenant.

Estimated Size: High.

Priority: Medium before MVP, Critical before AI features.

Features:

- F-AI-01: AI Gateway skeleton.
- F-AI-02: prompt registry and privacy filter.
- F-AI-03: evaluation and metering.

Tasks:

| Task ID | Task | Effort | Skills | Dependencies | Output | Tests | Review |
|---|---|---:|---|---|---|---|---|
| AI-001 | Define low-risk AI feature gate | 0.5d | AI, Product | AI guidelines | gate spec | review | AI/Product |
| AI-002 | Implement AI gateway interface | 1.5d | AI/Backend | platform | gateway skeleton | unit tests | AI lead |
| AI-003 | Implement prompt registry spec | 1d | AI | AI-002 | prompt registry | prompt tests | AI/Security |
| AI-004 | Implement AI usage metering | 1d | Backend | tenant billing | metering | usage tests | Backend/Product |
| AI-005 | Define evaluation harness | 1d | AI, QA | AI guidelines | eval plan | eval examples | AI/QA |

### EPIC-OBS-01: Observability And Support

Objective: make workflows visible and supportable.

Scope: tracing, dashboards, alerts, support access, runbooks.

Deliverables: observability baseline.

Dependencies: platform foundation and critical workflows.

Risks: silent production failures.

Acceptance Criteria:

- payment, sync, notification, login dashboards exist.
- support access is audited.

Estimated Size: High.

Priority: Critical.

Features:

- F-OBS-01: telemetry foundation.
- F-OBS-02: workflow dashboards.
- F-OBS-03: support operations.

Tasks:

| Task ID | Task | Effort | Skills | Dependencies | Output | Tests | Review |
|---|---|---:|---|---|---|---|---|
| OBS-001 | Define correlation ID standard | 0.5d | Backend, SRE | architecture | trace standard | smoke test | SRE |
| OBS-002 | Implement logging/tracing skeleton | 1.5d | Backend, SRE | platform | telemetry | trace test | SRE |
| OBS-003 | Build critical workflow dashboards | 2d | SRE | workflow events | dashboards | alert dry run | SRE/Support |
| OBS-004 | Define support access workflow | 1d | Security, Support | access bible | workflow spec | audit review | Security |
| OBS-005 | Create incident runbooks | 1d | SRE | runbook docs | runbooks | tabletop | SRE |

### EPIC-INFRA-01: Infrastructure And CI/CD

Objective: create repeatable, recoverable environments.

Scope: local/dev/staging/prod, CI, secrets, backups, release process.

Deliverables: deployment foundation.

Dependencies: platform foundation.

Risks: failed restore, secret leak.

Acceptance Criteria:

- staging deploy works.
- restore drill completes.

Estimated Size: High.

Priority: Critical.

Features:

- F-INFRA-01: environment setup.
- F-INFRA-02: CI/CD pipeline.
- F-INFRA-03: backup and restore.

Tasks:

| Task ID | Task | Effort | Skills | Dependencies | Output | Tests | Review |
|---|---|---:|---|---|---|---|---|
| INFRA-001 | Decide MVP infrastructure topology | 1d | DevOps, Architect | deployment docs | topology decision | review | VP Eng |
| INFRA-002 | Create CI pipeline baseline | 1.5d | DevOps | repo | CI pipeline | CI run | DevOps |
| INFRA-003 | Configure secrets strategy | 1d | DevOps, Security | infra decision | secrets plan | secret scan | Security |
| INFRA-004 | Configure staging deployment | 2d | DevOps | app skeleton | staging env | deploy smoke | DevOps |
| INFRA-005 | Run backup/restore drill | 1.5d | DevOps, DBA | DB env | restore report | restore validation | SRE/DBA |

### EPIC-QA-01: Test Automation Foundation

Objective: establish risk-driven quality gates.

Scope: unit, integration, E2E, tenant isolation, permission, payment, offline, AI tests.

Deliverables: test harness and critical test suites.

Dependencies: platform and domain specs.

Risks: success-path-only testing.

Acceptance Criteria:

- critical risk suites are automated or specified before feature completion.

Estimated Size: High.

Priority: Critical.

Features:

- F-QA-01: test fixtures.
- F-QA-02: critical risk test suites.
- F-QA-03: release quality reports.

Tasks:

| Task ID | Task | Effort | Skills | Dependencies | Output | Tests | Review |
|---|---|---:|---|---|---|---|---|
| QA-001 | Define multi-tenant fixtures | 1d | QA, Backend | DB freeze | fixtures | fixture smoke | QA |
| QA-002 | Build tenant isolation test suite | 2d | QA, Backend | RLS | test suite | automated | Security |
| QA-003 | Build permission golden tests | 1.5d | QA, Security | authz | test suite | automated | Security |
| QA-004 | Build payment replay tests | 1.5d | QA, Payments | payment spec | test suite | automated | Payments |
| QA-005 | Build offline conflict tests | 1.5d | QA, Offline | sync spec | test suite | automated | Offline lead |

## Dependency Graph

```text
Architecture Freeze
  -> Database Freeze
      -> Tenant Engine
      -> Finance Ledger
      -> Academic Foundation
      -> Offline Sync Model
  -> API Contract Freeze
      -> Backend Feature Work
      -> Frontend Feature Work
      -> QA Contract Tests
  -> Design System Freeze
      -> Frontend Foundation
      -> Mobile Readiness

Platform Foundation
  -> Identity
      -> Tenant Engine
          -> Authorization
              -> Student Registry
              -> Academic Structure
              -> Attendance
              -> Assessment
              -> Finance

Finance Ledger
  -> Payment Orchestration
      -> Receipts
      -> Reconciliation
      -> Parent Payment UX

Student Registry + Guardian Links
  -> Parent Portal
  -> Notifications
  -> Attendance
  -> Marks/Reports

Outbox + Observability
  -> Notifications
  -> Payments
  -> Reports
  -> Offline Sync
```

## Critical Path

1. Architecture Freeze v1.0.
2. Database Freeze v1.0.
3. API Contract Freeze v1.0.
4. Design System Freeze v1.0.
5. Platform Foundation.
6. Identity.
7. Tenant Engine and RLS enforcement.
8. Authorization policy service.
9. Student registry and academic structure.
10. Attendance and offline sync.
11. Finance ledger.
12. Payment provider and reconciliation.
13. SMS notification engine.
14. Parent portal and teacher workflows.
15. Observability, backup restore, security hardening.
16. Pilot release.

## Parallel Development Plan

### Can Run In Parallel After Architecture Freeze

- Database Freeze work.
- API Contract inventory.
- Design System Freeze.
- Infrastructure topology decision.
- QA fixture planning.
- Provider selection for identity/payment/SMS.

### Can Run In Parallel After Database/API/Design Freeze

- backend platform skeleton.
- frontend app shell.
- CI/CD.
- test harness.
- observability skeleton.
- identity integration.

### Must Be Sequential

- RLS before tenant-dependent features.
- policy authorization before sensitive domain workflows.
- ledger before payments.
- payment attempt lifecycle before reconciliation.
- attendance online before offline sync.
- API contract before frontend build.
- design system before production UI.

### Integration Checkpoints

| Checkpoint | Participants | Goal |
|---|---|---|
| IC-01 Freeze Review | Product, Architecture, Backend, Frontend, QA, Security | database/API/design readiness |
| IC-02 Auth/Tenant Integration | Backend, Security, DBA | tenant context and RLS validated |
| IC-03 Finance/Payment Integration | Backend, Finance, QA, SRE | ledger, payment, receipt, reconciliation |
| IC-04 Offline Integration | Backend, Frontend, QA | offline attendance sync |
| IC-05 Pilot Readiness | All teams | end-to-end UAT |

### Merge Strategy

- trunk-based development.
- short-lived branches.
- feature flags for incomplete features.
- code owners for critical domains.
- contract tests before merging cross-team changes.

### Branch Strategy

Use:

- `feature/<workstream>-<short-name>`
- `fix/<workstream>-<short-name>`
- `chore/<short-name>`
- `adr/<decision-name>`

## Quality Gates

### Architecture Gate

Entry: SRS and architecture docs complete.

Exit:

- Architecture Freeze accepted.
- ADRs accepted.
- critical risks documented.

### Database Gate

Entry: Architecture Freeze.

Exit:

- ERD accepted.
- RLS plan accepted.
- migration strategy accepted.
- tenant isolation tests defined.

### API Contract Gate

Entry: MVP workflow inventory.

Exit:

- OpenAPI baseline.
- BFF contracts.
- error/idempotency rules.
- auth rules per endpoint.

### UI Review Gate

Entry: MVP workflow list.

Exit:

- role navigation.
- mobile layouts.
- offline/error/loading states.
- accessibility baseline.

### Security Gate

Entry: feature ready for merge.

Exit:

- authz reviewed.
- sensitive logging reviewed.
- tenant isolation considered.
- audit events included.

### Testing Gate

Entry: feature implementation complete.

Exit:

- unit/integration/E2E as applicable.
- tenant tests for tenant-owned data.
- replay/idempotency tests for critical workflows.

### Performance Gate

Entry: workflow nearing pilot.

Exit:

- p95 baseline measured.
- background jobs not blocking request path.
- dashboard payloads acceptable.

### Documentation Gate

Entry: feature ready for release.

Exit:

- developer docs.
- support notes.
- user-facing guide if needed.

### Release Gate

Entry: release candidate.

Exit:

- rollback plan.
- feature flags.
- dashboards.
- support readiness.
- go/no-go approval.

## Risk Register

| Risk | Probability | Impact | Mitigation | Contingency | Owner |
|---|---|---|---|---|---|
| Cross-tenant data exposure | Medium | Critical | RLS, tests, code review | disable affected feature, incident response | Security Lead |
| Ledger imbalance | Medium | Critical | ledger tests, finance review | freeze payments, reconciliation review | Finance Lead |
| Payment webhook duplication | High | High | idempotency, replay tests | reconciliation job | Payments Lead |
| Offline sync corruption | Medium | Critical | operation sync, conflict tests | disable offline for workflow | Offline Lead |
| API contract churn | Medium | High | API freeze | contract versioning | API Lead |
| Provider sandbox delay | Medium | Medium | early provider selection | use adapter mock | TPM |
| Weak observability | Medium | High | workflow dashboards | manual support checks | SRE Lead |
| Scope creep | High | High | MVP gates | backlog deferral | Product Lead |
| AI privacy issue | Low initially | Critical | AI Gateway, low-risk AI first | disable AI feature | AI Lead |
| Failed restore | Medium | Critical | restore drills | incident escalation | SRE Lead |
| Frontend/backend merge conflicts | Medium | Medium | contracts and branch discipline | integration branch freeze | Eng Manager |
| Permission model too complex | Medium | High | golden tests and explainability | policy simplification ADR | Security/Architect |

## Engineering Standards

### Code Quality

- TypeScript strict mode.
- module boundary enforcement.
- small PRs.
- no cross-module table access.
- no secrets in code.

### Commit Messages

Format:

- `feat: add tenant context middleware`
- `fix: prevent cross-tenant access`
- `test: add payment replay cases`
- `docs: update API freeze checklist`

### Pull Requests

Every PR includes:

- summary.
- risk level.
- tests.
- screenshots for UI.
- migration notes.
- security/privacy notes.
- rollback notes when relevant.

### Code Reviews

Required specialist reviews:

- security for auth/authz/RLS.
- finance for ledger/payment.
- offline lead for sync.
- AI lead for AI features.
- DBA for migrations.
- SRE for observability/deploy changes.

### Testing

No critical feature ships with success-path-only testing.

Mandatory for sensitive areas:

- tenant isolation tests.
- permission golden tests.
- payment replay tests.
- ledger balancing tests.
- offline conflict tests.
- AI privacy tests.

### Documentation

Each feature updates:

- API docs if endpoint changes.
- developer docs if architecture changes.
- support docs if user-facing workflow changes.
- ADR if architecture decision changes.

## Release Strategy

### Internal Alpha

Goal: prove foundation workflows internally.

Scope:

- login.
- tenant setup.
- basic student registry.
- academic setup.

Exit Criteria:

- no critical auth/tenant defects.
- basic deployment works.

Rollback:

- feature flags and environment rollback.

Success Metrics:

- local/staging reliability.
- auth/tenant tests passing.

### Engineering QA

Goal: validate MVP workflows under test conditions.

Scope:

- attendance.
- marks.
- invoices.
- payments sandbox.
- notifications sandbox.

Exit Criteria:

- critical test suites pass.
- dashboards exist.
- restore drill complete.

Rollback:

- disable risky feature flags.
- revert release candidate.

### Closed Beta

Goal: validate with controlled users and sample data.

Scope:

- school admin workflows.
- teacher attendance.
- parent portal basics.

Exit Criteria:

- no SEV-1/SEV-2 open.
- support workflow tested.

Success Metrics:

- task completion rate.
- payment sandbox success.
- attendance sync success.

### Pilot Schools

Goal: validate production with 3-5 schools.

Scope:

- real tenant onboarding.
- real students.
- real attendance.
- controlled real payments if approved.
- SMS notifications.

Exit Criteria:

- no tenant isolation incidents.
- payment reconciliation within agreed SLA.
- restore drill passed.
- support response process works.

Rollback:

- disable payment provider if needed.
- freeze onboarding.
- restore from backup if necessary.

### Public Beta

Goal: expand to more schools with controlled support.

Exit Criteria:

- onboarding repeatable.
- support tickets manageable.
- critical workflows stable.
- observability coverage complete.

### General Availability

Goal: public production launch.

Exit Criteria:

- SLA posture approved.
- security review complete.
- DR tested.
- documentation complete.
- support operations staffed.

## Milestone Roadmap

| Milestone | Main Outcome |
|---|---|
| M0 | Architecture Freeze complete |
| M1 | Database/API/Design freezes complete |
| M2 | Platform foundation running |
| M3 | Auth, tenant, authorization complete |
| M4 | Academic foundation complete |
| M5 | Attendance online/offline complete |
| M6 | Finance ledger complete |
| M7 | Payments/reconciliation complete |
| M8 | SMS and parent portal complete |
| M9 | Pilot hardening complete |
| M10 | Public beta |
| M11 | GA |

## Final Recommendation

Adopt the Master Engineering Execution Prompt and AI-EOS, then proceed to Sprint 1: Database Design Freeze. After the required freeze gates are accepted for the first slice, execute Sprint 0 Engineering Foundation.

Do not start production coding until Database Freeze, API Contract Freeze, and Design System Freeze are accepted for the relevant slice.

