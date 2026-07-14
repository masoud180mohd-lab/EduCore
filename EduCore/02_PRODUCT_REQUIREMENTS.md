# 02 Product Requirements

## Canonical Relationship

This document is the product baseline and MVP workflow summary. `34_SOFTWARE_REQUIREMENTS_SPECIFICATION.md` is the canonical consolidated implementation-requirements source. If a requirement differs, follow the Development Constitution, accepted ADRs, frozen SRS, and the authority order in `00_START_HERE.md`.
## MVP Scope

MVP must prove that schools trust EduCore for daily operations. Keep it narrow.

### MVP Workflows

1. Create tenant and school profile.
2. Manage users and roles.
3. Register students.
4. Set academic years, terms, classes, streams, and subjects.
5. Mark attendance, including offline teacher flow.
6. Enter marks and approve them.
7. Generate basic report cards.
8. Create fee structures and invoices.
9. Receive mobile money payments.
10. Generate receipts.
11. Reconcile payment status.
12. Notify parents by SMS first, WhatsApp later.
13. Parent views child attendance, marks, fees, and receipts.

### Out Of MVP

- Full HR/payroll.
- Full inventory.
- Hostel.
- Transport GPS.
- Library advanced features.
- Blockchain certificates.
- AI voice assistant.
- Marketplace APIs.
- Enterprise white-labeling.
- Multi-region deployment.

## Personas And Primary Jobs

### Headmaster

Needs dashboard visibility into attendance, performance, fees, and operational risks.

### Academic Master

Needs to manage classes, exams, marks approval, and academic performance reports.

### Teacher

Needs fast attendance and marks entry, including offline mode.

### Accountant / Bursar

Needs invoices, payments, receipts, reconciliation, and ledger integrity.

### Parent

Needs simple access to child status, fee balance, receipts, attendance, and announcements.

### Student

Needs timetable, results, assignments, and school communication where appropriate.

### Platform Support

Needs safe support tooling without unrestricted data access.

## Functional Requirements

### Tenant Management

- Create school tenant.
- Configure school metadata.
- Configure language, timezone, currency.
- Manage subscription plan and entitlements.
- Enforce feature limits.

### Identity And Access

- User accounts.
- Password and MFA policy.
- Role assignment.
- Relationship-aware access.
- Delegation and temporary access.
- Break-glass support access with audit.

### Academics

- Students.
- Classes.
- Streams.
- Subjects.
- Teacher assignments.
- Academic years and terms.
- Attendance.
- Exam setup.
- Marks entry.
- Marks approval.
- Report cards.

### Finance

- Fee structures.
- Invoices.
- Payment attempts.
- Gateway callbacks.
- Receipts.
- Immutable ledger.
- Reconciliation.
- Refunds and reversals in later phase.

### Communication

- SMS notifications in MVP.
- WhatsApp in phase 2.
- Email and push later.
- Templates.
- Delivery status.
- Consent and preferences.
- Cost tracking.

### Offline

Only selected workflows are offline-capable:

- Attendance first.
- Marks second.
- Remarks later.

Offline support must use operation logs and server-side conflict rules.

### AI

MVP AI should be low-risk:

- Draft report comments.
- Explain dashboard trends.
- Generate admin summaries.
- Help users navigate the system.

High-risk AI such as student failure prediction or teacher performance scoring requires governance, evaluation, and human review.

## Non-Functional Requirements

- API p95 target: under 300ms for common requests after pilot optimization.
- Dashboard target: usable on low-end devices and 3G.
- Availability target: 99.5% MVP, 99.9% Pro+ after operational maturity.
- Offline target: teacher attendance works for 72 hours offline.
- Security: tenant isolation tests required.
- Privacy: child data classified and protected.
- Data retention: financial records 7 years by default.
- Accessibility: WCAG 2.1 AA target.
- i18n: Kiswahili and English from phase 1.

## Acceptance Rule

A feature is not done until:

- It is permission-tested.
- It is tenant-isolation-tested.
- It emits audit events if sensitive.
- It has observability.
- It has rollback or recovery behavior.
- It has user-facing error states.

