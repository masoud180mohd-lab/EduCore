# 04 System Architecture

## Architecture Summary

EduCore uses a modular monolith first, with clear bounded contexts and strict module boundaries. The platform should be simple enough for a startup team to operate, but structured enough to evolve into services later.

## High-Level Components

- Web App: Next.js.
- Mobile App: React Native Expo.
- API Backend: NestJS modular monolith.
- AI Service: FastAPI behind AI Gateway.
- Database: PostgreSQL with RLS.
- Cache/Queue: Redis, separated by purpose.
- Object Storage: S3-compatible private storage.
- Notifications: SMS first, WhatsApp later.
- Payments: payment orchestration adapters.
- Observability: OpenTelemetry, Prometheus, Grafana, Loki, Sentry.

## Bounded Contexts

### Identity And Access

Owns users, sessions, MFA, roles, policies, relationships, delegations, and access reviews.

### Tenant And Billing

Owns tenants, plans, subscriptions, entitlements, usage events, and billing state.

### Student Registry

Owns student profile, admission number, guardianship relationships, status, and student identity.

### Academic Structure

Owns academic years, terms, streams, classes, subjects, and teacher assignments.

### Attendance

Owns attendance capture, offline attendance sync, attendance corrections, and attendance reports.

### Assessment

Owns exams, marks, approval workflows, report cards, and academic performance reports.

### Finance Ledger

Owns journal entries, accounts, invoice accounting, balances, reversals, and financial reports.

### Payments

Owns payment attempts, gateway callbacks, idempotency, settlement, reconciliation, and provider adapters.

### Communication

Owns templates, notification requests, delivery ledgers, preferences, consent, and providers.

### Documents And Files

Owns upload policy, file metadata, signed URLs, malware scanning, and retention.

### AI Insights

Owns AI Gateway, prompts, model registry, evaluations, budgets, and AI feature execution.

### Integrations

Owns government exports, bank integrations, future API ecosystem, and third-party adapters.

### Analytics

Owns read models, dashboards, aggregate metrics, and reporting pipelines.

### Platform Operations

Owns audit, support tooling, observability, backups, and operational controls.

## Tenancy Model

Default model:

- Shared PostgreSQL database.
- Every tenant-owned table has `tenant_id`.
- PostgreSQL RLS enabled on tenant-owned tables.
- Application-level tenant guard.
- Tenant-aware indexes.
- Tenant isolation tests in CI.

Do not use schema-per-tenant by default. Enterprise physical isolation requires a separate ADR.

## Module Communication

Allowed:

- Public module interfaces.
- Application services.
- Domain events through outbox.
- Read models owned by analytics.

Not allowed:

- Direct cross-module table access.
- Importing internal services from another bounded context.
- Sharing mutable domain models across contexts.

## Event Architecture

Use transactional outbox for domain events:

- PaymentReceived
- PaymentFailed
- LedgerEntryPosted
- AttendanceRecorded
- MarksSubmitted
- MarksApproved
- NotificationRequested
- TenantCreated
- UserRoleChanged

Event handlers must be idempotent.

## CQRS And Event Sourcing Policy

Use CQRS selectively:

- Finance ledger.
- Payments.
- Audit.
- Offline sync.
- Analytics read models.

Do not event-source simple CRUD modules unless required.

## Scalability Strategy

MVP:

- Modular monolith.
- Single primary PostgreSQL with backups.
- Redis for queue/cache/rate limits with separated namespaces.
- Background workers.

Growth:

- Read replicas.
- Dedicated worker pools.
- Search service if Postgres search is insufficient.
- Notification and payment components can be extracted.

Scale:

- Shard by tenant only when metrics justify it.
- Extract AI Gateway, payments, notifications, reports, and analytics.
- Kubernetes only when deployment complexity is justified.

## Critical Risks To Control

- Tenant data leakage.
- Financial inconsistency.
- Offline sync corruption.
- Payment webhook duplication.
- Notification cost explosion.
- AI hallucination or privacy leakage.
- Unrestorable backups.
- Over-broad support access.

