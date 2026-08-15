# 34 Software Requirements Specification

## Document Purpose

This is the explicit SRS for EduCore AI Development Kit v2.0.

Earlier kit documents split requirements across product, architecture, security, database, testing, and operations files. This document consolidates them into one clear requirements entry point so any AI agent or developer can understand what must be built.

## Canonical Product Name

**EduCore** is the canonical project and product name in all current engineering documentation. EdusNexus, EduNexus, and SmartShule are historical working aliases and must not be introduced into new technical artifacts unless a future naming decision explicitly approves them.
## Product Name

EduCore, also referred to in earlier planning as EdusNexus / EduNexus / SmartShule.

## Product Description

EduCore is a cloud-native, offline-capable, AI-ready, multi-tenant education operations platform for schools in Africa.

It must support school administration, academics, finance, parent engagement, communications, analytics, and future ecosystem integrations while remaining secure, scalable, affordable, and usable in weak internet conditions.

## Product Vision

Build the operating system for education in Africa.

EduCore must go beyond traditional school management software by connecting schools, parents, students, teachers, payments, government reporting, AI insights, and future trusted education data services.

## MVP Scope

The MVP must prove trust in core workflows, not ship every possible module.

### MVP In Scope

- Tenant onboarding.
- School profile setup.
- User management.
- Role and permission management.
- Student registry.
- Guardian/parent relationships.
- Academic years and terms.
- Classes, streams, and subjects.
- Teacher assignments.
- Attendance capture.
- Offline attendance workflow.
- Exams.
- Marks entry.
- Marks approval.
- Basic report cards.
- Fee structures.
- Invoices.
- Mobile money payment flow with one primary provider.
- Receipts.
- Basic reconciliation.
- SMS notifications.
- Parent portal basics.
- Audit trail for sensitive actions.
- Observability foundation.
- Backup and restore process.

### MVP Out Of Scope

- Blockchain certificates.
- Full marketplace APIs.
- Multi-region active-active deployment.
- Advanced voice assistant.
- Automated teacher performance judgement.
- Full transport GPS.
- Full hostel module.
- Full HR/payroll.
- Full inventory automation.
- University/employer integrations.

## User Roles

Primary roles:

- Super Admin.
- Platform Support.
- School Owner.
- Headmaster.
- Deputy Headmaster.
- Academic Master.
- Registrar.
- Accountant.
- Bursar.
- Secretary.
- Class Teacher.
- Subject Teacher.
- Student.
- Parent.

Secondary and later-phase roles:

- Librarian.
- Store Keeper.
- Hostel Master.
- Transport Manager.
- Nurse.
- Discipline Officer.
- Security Staff.
- Visitor.
- Government Education Officer.

## Functional Requirements

### Tenant And Billing

- The system must create and manage school tenants.
- The system must support subscription plans and entitlements.
- The system must meter variable-cost services such as SMS, WhatsApp, AI, storage, and payment usage.
- The system must support school-level settings for language, timezone, currency, branding, and academic configuration.

### Identity And Access

- The system must authenticate users securely.
- The system must support MFA for privileged users.
- The system must support RBAC, relationship-aware access, ABAC-style contextual rules, delegation, explicit deny rules, and RLS.
- The system must prevent parents, teachers, staff, and support users from accessing data outside their legitimate scope.
- The system must audit sensitive access and permission changes.

### Student Registry

- The system must manage student profiles.
- The system must support admission numbers.
- The system must link students to guardians.
- The system must track student status such as active, graduated, transferred, dropped, or suspended.
- The system must avoid unnecessary collection of sensitive child data.

### Academic Management

- The system must support academic years, terms, classes, streams, subjects, and teacher assignments.
- The system must support attendance capture by teacher.
- The system must support exam setup, marks entry, marks submission, marks approval, and report card generation.
- Approved marks must not be silently overwritten.

### Offline Workflows

- The system must support offline attendance in MVP.
- The system must use operation-based sync, not blind last-write-wins.
- Offline operations must include idempotency keys.
- Server must recheck permissions at sync time.
- Sync conflicts must be visible and reviewable.

### Finance And Accounting

- The system must support fee structures, invoices, payment attempts, receipts, and reconciliation.
- The ledger must be the source of truth.
- Balances must be derived from immutable journal entries.
- Corrections must use reversals, not destructive edits.
- Every posted journal entry must balance.

### Payments

- The system must support mobile money as the first payment path.
- Provider callbacks must be signature-verified where supported.
- Provider events must be stored, deduplicated, and processed idempotently.
- Reconciliation must exist independently of webhook success.
- Receipts must only be generated after accepted payment and ledger posting.

### Communication

- The system must support SMS notifications in MVP.
- The system must support delivery tracking.
- The system must support templates.
- The system must support parent communication preferences and consent.
- WhatsApp, email, and push notifications are later-phase channels.

### AI

- AI features must go through AI Gateway.
- MVP AI must be low-risk: summaries, drafts, explanations, help, and report comment drafts.
- High-risk AI such as student predictions or teacher performance analysis requires evaluation, human review, and privacy controls.
- AI usage must be metered per tenant.

### Documents And Files

- Files must be stored privately by default.
- Access must use signed URLs or equivalent controls.
- Sensitive documents must follow retention and privacy rules.
- Public CDN use is allowed only for public assets.

### Audit And Compliance

- The system must audit sensitive actions.
- Audit logs must avoid raw sensitive values where possible.
- Support access must be time-bound and audited.
- The platform must prepare for data protection obligations involving child data, financial records, and school records.

## Non-Functional Requirements

### Security

- Deny by default.
- Tenant isolation is mandatory.
- PostgreSQL RLS is mandatory for tenant-owned data.
- Sensitive data must be protected in logs, audit, exports, and AI calls.
- Security testing is required before public launch.

### Performance

- Common API p95 should target under 300ms after pilot optimization.
- Dashboards must work acceptably on low-end devices and weak networks.
- Long-running work such as reports, notifications, AI jobs, and reconciliation must use background workers.

### Availability

- MVP availability target: 99.5%.
- Pro+ target after operational maturity: 99.9%.
- Backups and restore drills are required.

### Scalability

- The default tenancy model is shared PostgreSQL with RLS.
- Schema-per-tenant is not the default path.
- Future service extraction should be driven by scaling, reliability, or team ownership needs.

### Observability

- The system must track workflow-level SLOs, not only server uptime.
- Critical workflows include login, attendance sync, payment confirmation, receipt generation, notification delivery, AI usage, and report generation.

### Privacy

- Child data must be classified and protected.
- AI features must minimize data exposure.
- Data retention and tenant exit processes must be defined.

### Internationalization

- Kiswahili and English are required from early phases.
- Currency, timezone, and date formatting must be configurable.

## Acceptance Criteria For Any Feature

A feature is not complete until:

- authorization is defined.
- tenant isolation is tested.
- audit impact is handled.
- observability is added.
- failure states are handled.
- tests exist.
- privacy impact is reviewed.
- rollback or recovery path exists for risky changes.

## Amendments

### AMEND-2026-08-15 (Owner GO in session, SOLO-GOV-003 gate form; source: SPEC-PORTALS-001 v1.0)

1. **MVP In Scope additions (platform layer):**
   - Platform tenant lifecycle administration by Super Admin: register, list, view health/status, suspend, reinstate.
   - Manual subscription plan assignment per tenant (existing `plans` catalog; no automated invoicing in MVP).
   - Tenant entitlement/feature flags managed by Super Admin.
   - Platform audit trail view for privileged platform actions.
   - Full subscription **invoicing/charging remains out of MVP scope** (later phase).
2. **Student portal:** added as **later-phase scope (SPEC-PORTALS-001 Phase 4)** — read-only (attendance, published results, fee balance/receipts, messages). Student identity/credential design is a Phase 4 gate. Not MVP.
3. **Timetable module:** explicitly **excluded** from v1 (Owner decision Q3). Student portal v1 ships without timetable.
4. **Explicit deny addition:** an approver must not approve marks they themselves submitted as a teacher (see `32_ACCESS_CONTROL_BIBLE.md`).

## Related Documents

- `02_PRODUCT_REQUIREMENTS.md`
- `03_DEVELOPMENT_CONSTITUTION.md`
- `04_SYSTEM_ARCHITECTURE.md`
- `20_PAYMENT_ACCOUNTING_BIBLE.md`
- `21_OFFLINE_SYNC_BIBLE.md`
- `32_ACCESS_CONTROL_BIBLE.md`
- `35_PROJECT_ARCHITECTURE.md`

