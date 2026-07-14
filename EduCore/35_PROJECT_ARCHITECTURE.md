# 35 Project Architecture

## Document Purpose

This is the explicit project architecture document for EduCore AI Development Kit v2.0.

Earlier architecture decisions are distributed across `04_SYSTEM_ARCHITECTURE.md`, ADRs, and domain bible documents. This file gives a single architecture overview that replaces ambiguity and gives AI agents a clear architecture entry point.

## Canonical Status

This is the canonical frozen architecture baseline for current implementation planning. `04_SYSTEM_ARCHITECTURE.md` is supplemental context and cannot override this document, `38_ARCHITECTURE_FREEZE_RECORD.md`, the Development Constitution, or accepted ADRs.
## Architecture Thesis

EduCore starts as a disciplined modular monolith, not microservices. It uses strong domain boundaries, shared PostgreSQL with RLS, transactional outbox, operation-based offline sync, ledger-first finance, and AI Gateway governance.

The architecture must support MVP speed without sacrificing the future platform.

## High-Level Architecture

```text
Client Layer
  - Web App: Next.js / React / TypeScript
  - Mobile App: React Native / Expo
  - Future: USSD / WhatsApp Bot

Edge Layer
  - CDN / WAF / DDoS protection
  - Reverse proxy / API gateway
  - Rate limiting

Application Layer
  - NestJS Modular Monolith
  - Background workers
  - AI Gateway / AI Service
  - Payment orchestration
  - Notification service

Data Layer
  - PostgreSQL with RLS
  - Redis for cache, queues, rate limits
  - Object storage
  - Search later if PostgreSQL search is insufficient

External Integrations
  - Mobile money providers
  - SMS providers
  - WhatsApp providers
  - Email providers
  - AI providers
  - Government reporting systems
```

## Core Architecture Decisions

### Modular Monolith First

EduCore starts as a modular monolith because the company needs speed, lower operational complexity, easier transactions, and clearer debugging during MVP.

Microservices are future extraction targets, not the starting point.

### Shared PostgreSQL With RLS

Default tenancy:

- shared database.
- `tenant_id` on tenant-owned tables.
- RLS on tenant-owned tables.
- application-level tenant guard.
- tenant-aware indexes.
- automated tenant isolation tests.

Schema-per-tenant and database-per-tenant require future enterprise ADRs.

### Ledger-First Finance

Finance is not a CRUD module. It is an accounting subsystem.

Rules:

- ledger is source of truth.
- posted entries are immutable.
- corrections use reversals.
- balances are derived.
- payments reconcile through ledger and provider events.

### Operation-Based Offline Sync

Offline sync uses operation logs and server conflict handling.

Rules:

- no blind last-write-wins for sensitive data.
- attendance offline first.
- marks offline later.
- approved marks cannot be overwritten silently.
- permissions are rechecked at sync time.

### AI Gateway

All AI features go through AI Gateway.

AI Gateway controls:

- model routing.
- prompts.
- privacy filtering.
- tenant budgets.
- evaluation.
- logging.
- rate limits.

### Transactional Outbox

Critical domain events are written to an outbox in the same transaction as domain state changes.

Used for:

- payment events.
- ledger posting.
- notifications.
- marks approval.
- attendance sync.
- audit events.
- AI jobs.

## Bounded Context Architecture

### Identity And Access

Owns users, roles, policies, sessions, MFA, relationships, delegations, and support access.

### Tenant And Billing

Owns tenants, plans, subscriptions, entitlements, usage metering, and tenant configuration.

### Student Registry

Owns students, guardians, student status, admissions, and student identity data.

### Academic Structure

Owns years, terms, classes, streams, subjects, and teacher assignments.

### Attendance

Owns attendance sessions, records, corrections, and offline attendance sync.

### Assessment

Owns exams, marks, approvals, report cards, and academic reports.

### Finance Ledger

Owns chart of accounts, journal entries, invoices, allocations, receipts, reversals, and finance reports.

### Payments

Owns payment attempts, provider callbacks, settlements, refunds, and reconciliation.

### Communication

Owns notification templates, requests, delivery status, preferences, and consent.

### Documents And Files

Owns file metadata, upload policy, private storage, signed URLs, and retention.

### AI Insights

Owns AI Gateway, prompts, model registry, evaluation, budgets, and AI feature execution.

### Integrations

Owns external system adapters, government exports, provider contracts, and partner APIs.

### Analytics

Owns read models, dashboards, aggregate metrics, and product analytics.

### Platform Operations

Owns audit, support tools, incident response, observability, backups, and runbooks.

## API Architecture

Default:

- REST APIs.
- role-specific BFF endpoints.
- OpenAPI documentation.

Deferred:

- GraphQL, unless approved by future ADR.

API requirements:

- tenant-scoped requests.
- policy authorization.
- consistent error shape.
- idempotency for retryable mutations.
- audit for sensitive actions.
- rate limits.

## Database Architecture

Primary database:

- PostgreSQL.

Core rules:

- UUID v7 or equivalent sortable UUID.
- tenant-owned tables include `tenant_id`.
- tenant-owned tables use RLS.
- sensitive data classified.
- money stored as integer minor units.
- audit logs redacted where required.
- partition high-volume tables when needed.

High-volume candidates:

- audit events.
- outbox events.
- notification deliveries.
- payment events.
- attendance records.
- ledger entries.

## Background Job Architecture

Use workers for:

- notifications.
- payment reconciliation.
- webhook processing.
- report generation.
- AI batch tasks.
- offline sync processing.
- scheduled reminders.

Worker requirements:

- idempotent.
- retriable.
- observable.
- dead-lettered.
- linked to correlation IDs.

## Security Architecture

Security layers:

1. edge protections.
2. authentication.
3. tenant membership.
4. policy authorization.
5. relationship scope.
6. RLS.
7. audit trail.

Support access must be time-bound, purpose-bound, and audited.

## Observability Architecture

Every critical workflow must be observable:

- login.
- attendance sync.
- marks approval.
- payment confirmation.
- receipt generation.
- notification delivery.
- report generation.
- AI usage.
- backup success.

Use:

- structured logs.
- metrics.
- traces.
- audit events.
- dashboards.
- alerts.

## Deployment Architecture

MVP:

- simple reproducible deployment.
- Docker packaging.
- managed or well-operated PostgreSQL.
- Redis.
- object storage.
- background workers.
- backups.
- staging and production.

Kubernetes:

- future option only when operationally justified.

## Future Service Extraction

Likely candidates:

- payment orchestration.
- notification service.
- AI Gateway.
- report generation.
- search indexing.
- analytics pipeline.

Extraction triggers:

- independent scaling.
- team ownership.
- reliability boundary.
- release cadence.
- operational blast-radius reduction.

## Architecture Risks

Critical risks:

- cross-tenant data exposure.
- payment misposting.
- offline sync corruption.
- AI privacy leak.
- support access misuse.
- unrecoverable backups.
- scope overload.

Mitigations are defined in:

- `16_SECURITY_STANDARDS.md`
- `20_PAYMENT_ACCOUNTING_BIBLE.md`
- `21_OFFLINE_SYNC_BIBLE.md`
- `22_OBSERVABILITY_BIBLE.md`
- `23_INCIDENT_RESPONSE_RUNBOOK.md`
- `25_RISK_REGISTER.md`
- `32_ACCESS_CONTROL_BIBLE.md`

