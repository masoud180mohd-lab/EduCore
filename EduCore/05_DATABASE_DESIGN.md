# 05 Database Design

## Database Philosophy

PostgreSQL is the system of record. Treat database design as product architecture, not implementation detail.

## Core Rules

- Use UUID v7 or another time-sortable UUID strategy.
- Tenant-owned tables must include `tenant_id`.
- Tenant-owned tables must enable RLS.
- Money values must be integer minor units.
- Store timestamps in UTC.
- Sensitive fields must be classified.
- Use soft deletes only when retention rules are clear.
- Avoid JSONB for core relational facts.
- Use JSONB for controlled custom metadata only.

## Data Classification

Every field must be classified:

- Public.
- Internal.
- Sensitive.
- Child-sensitive.
- Health-sensitive.
- Financial.
- Credential-like.
- Audit-critical.

Classification controls logging, audit, export, retention, encryption, and access.

## Core Schemas / Context Ownership

### Tenant And Billing

Conceptual tables:

- tenants
- plans
- subscriptions
- entitlements
- usage_events
- metered_charges

### Identity And Access

Conceptual tables:

- users
- sessions
- mfa_factors
- roles
- permissions
- policies
- user_roles
- relationships
- delegations
- access_reviews

### Student Registry

Conceptual tables:

- students
- guardians
- student_guardians
- admissions
- student_status_history

### Academic Structure

Conceptual tables:

- academic_years
- terms
- classes
- streams
- subjects
- teacher_assignments
- enrollments

### Attendance

Conceptual tables:

- attendance_sessions
- attendance_records
- attendance_corrections
- offline_operations
- sync_batches

### Assessment

Conceptual tables:

- exams
- exam_subjects
- marks
- marks_submissions
- marks_approvals
- report_cards

### Finance Ledger

Conceptual tables:

- chart_of_accounts
- journal_entries
- journal_lines
- invoices
- invoice_lines
- payment_allocations
- receipts
- reversals

Finance rule: balances are derived from ledger entries, not manually trusted fields.

### Payments

Conceptual tables:

- payment_attempts
- payment_gateway_events
- payment_methods
- settlements
- reconciliation_runs
- reconciliation_items
- refunds

### Communication

Conceptual tables:

- notification_templates
- notification_requests
- notification_deliveries
- communication_preferences
- consent_records
- provider_messages

### Audit And Operations

Conceptual tables:

- audit_events
- security_events
- support_access_sessions
- outbox_events
- inbox_events
- job_runs

## RLS Requirements

Every tenant-owned table must enforce:

- `tenant_id = current_setting('app.current_tenant')::uuid`

Important:

- Tenant context must be transaction-scoped.
- Do not rely on long-lived connection state.
- Use automated tests that attempt cross-tenant reads and writes.
- Platform support bypass must be explicit, time-bound, and audited.

## Ledger Requirements

Ledger entries are immutable after posting.

Rules:

- Every journal entry must balance.
- Every line has account, debit or credit, amount, currency, tenant, and reference.
- Corrections are reversals, not edits.
- Payments are allocated to invoices.
- Gateway callbacks do not directly mutate balances.
- Reconciliation compares gateway state, bank state, and internal ledger state.

## Offline Sync Data Model

Use operation-based sync:

- client_operation_id
- tenant_id
- actor_user_id
- device_id
- operation_type
- entity_type
- entity_id
- payload
- base_version
- client_created_at
- server_received_at
- idempotency_key
- status

Server assigns:

- server_sequence
- canonical_version
- conflict_status

## Audit Requirements

Audit events must record:

- actor.
- tenant.
- action.
- resource.
- before/after summary.
- timestamp.
- IP/user agent where applicable.
- reason for sensitive support/admin access.

Do not store raw sensitive values in audit logs unless required. Prefer redacted diffs.

## Partitioning Candidates

Partition early or plan partitioning for:

- audit_events
- outbox_events
- notification_deliveries
- payment_gateway_events
- attendance_records
- journal_entries / journal_lines at high scale

## Backup And Restore Requirements

- Point-in-time recovery.
- Daily logical backup where needed.
- Object storage backup.
- Restore drills.
- Tenant-level export strategy.
- Runbook for accidental data corruption.

