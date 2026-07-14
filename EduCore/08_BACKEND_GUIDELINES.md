# 08 Backend Guidelines

## Backend Stack

- NestJS.
- TypeScript.
- PostgreSQL.
- Redis.
- OpenTelemetry.
- Transactional outbox.

## Module Structure

Each bounded context should have:

- module definition.
- controllers.
- application services.
- domain services.
- repositories.
- DTOs.
- policies.
- events.
- tests.

No module may directly query another module's tables.

## Application Layers

Preferred direction:

- Controller: HTTP boundary only.
- Application service: use cases and transactions.
- Domain service: business rules.
- Repository: persistence.
- Policy service: authorization.
- Event publisher: outbox.

## Authorization

All protected handlers must:

- Require authentication.
- Resolve tenant.
- Check policy.
- Apply relationship scope.
- Use RLS as final protection.

Do not rely on frontend hiding buttons.

## Transactions

Use transactions for:

- Payment processing.
- Ledger posting.
- Marks approval.
- Role changes.
- Offline sync batch application.
- Tenant provisioning.

If a transaction emits events, write events to outbox within the same transaction.

## Background Jobs

Jobs must be:

- Idempotent.
- Retriable.
- Observable.
- Dead-lettered after repeated failure.
- Linked to trace/correlation ID.

## Payment Backend Rules

- Never trust amount from client.
- Verify amount server-side.
- Verify webhook signatures.
- Store gateway raw event safely.
- Deduplicate callbacks.
- Reconcile asynchronously.
- Ledger posting must be balanced.

## Offline Backend Rules

- Every offline mutation has idempotency key.
- Server validates actor still has permission.
- Server applies domain-specific conflict rules.
- Sensitive conflicts go to review.
- Client clock is advisory only.

## Logging

Do log:

- request ID.
- tenant ID.
- user ID where safe.
- action.
- outcome.
- latency.

Do not log:

- password.
- token.
- OTP.
- raw child-sensitive data.
- full health notes.
- full payment credentials.

## Error Handling

Errors must be typed and user-safe.

Internal errors should not leak:

- SQL.
- provider secrets.
- stack traces.
- PII.

## Performance

Watch for:

- N+1 queries.
- missing tenant indexes.
- unbounded lists.
- heavy dashboard queries.
- report generation on request thread.
- synchronous notification sending.

