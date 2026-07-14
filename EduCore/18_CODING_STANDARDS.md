# 18 Coding Standards

## General Standards

- TypeScript strict mode.
- Clear module boundaries.
- No hidden cross-module dependencies.
- Small functions with meaningful names.
- Domain rules belong in domain/application services, not controllers.
- Tests are part of implementation.

## Naming

- Use domain names from `15_DOMAIN_MODEL_DDD.md`.
- Avoid vague names like `data`, `manager`, `helper`, or `utils` unless scoped.
- Use explicit command names: `ApproveMarks`, `PostJournalEntry`, `SyncAttendanceOperation`.

## Error Handling

- Use typed errors.
- Do not expose internal stack traces.
- Include request ID in API errors.
- Map provider errors to internal error codes.

## Logging

- Structured logs.
- Include trace ID, tenant ID, action, and outcome where safe.
- Redact sensitive fields.

## Tests

Every feature must include appropriate tests. Critical workflows need failure-mode tests.

## Code Review Checklist

- Does it preserve tenant isolation?
- Does it enforce authorization?
- Does it create audit events?
- Does it handle retries?
- Does it avoid sensitive logging?
- Does it follow module boundaries?
- Does it include tests?

