# 11 Testing Guidelines

## Testing Philosophy

Test the risks that can destroy trust:

- data leakage.
- incorrect permissions.
- financial inconsistency.
- offline corruption.
- payment duplication.
- privacy leaks.
- unrecoverable production failures.

## Test Types

### Unit Tests

Use for:

- domain rules.
- validators.
- policy helpers.
- ledger balancing.
- sync conflict rules.

### Integration Tests

Use for:

- database queries.
- RLS enforcement.
- transactions.
- outbox writes.
- payment callback processing.

### E2E Tests

Use for:

- teacher attendance.
- marks submission and approval.
- parent payment.
- receipt generation.
- role assignment.

### Load Tests

Use k6 or equivalent for:

- login.
- attendance burst.
- parent dashboard.
- payment callback burst.
- report generation.

## Mandatory Risk Test Suites

### Tenant Isolation Tests

Every module must prove:

- tenant A cannot read tenant B.
- tenant A cannot write tenant B.
- search cannot leak tenant B.
- analytics cannot leak tenant B.

### Authorization Golden Tests

Create fixed examples:

- parent sees own child only.
- subject teacher sees assigned subject only.
- class teacher sees assigned class.
- accountant cannot approve own sensitive transaction if separation applies.
- government officer read access is time-limited.

### Payment Replay Tests

Test:

- duplicate webhook.
- delayed webhook.
- failed webhook.
- amount mismatch.
- provider timeout.
- reconciliation correction.

### Ledger Tests

Every posted transaction must:

- balance debit and credit.
- be immutable.
- support reversal.
- derive correct balance.

### Offline Sync Tests

Test:

- duplicate operation.
- out-of-order operation.
- stale permission.
- deleted record conflict.
- clock drift.
- same record edited on two devices.

### AI Tests

Test:

- hallucination cases.
- privacy redaction.
- tenant isolation in RAG.
- prompt injection.
- cost limits.
- refusal behavior.

### Backup And Restore Tests

At minimum:

- restore latest backup.
- point-in-time restore.
- object storage restore.
- verify app starts against restored data.

## Definition Of Test Done

A critical feature is not done until failure modes are tested, not only success path.

