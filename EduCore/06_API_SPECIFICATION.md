# 06 API Specification

## API Strategy

Start with REST plus role-specific BFF endpoints. Do not introduce GraphQL until the team has strong authorization, query complexity limits, and caching governance.

## API Principles

- Version APIs.
- Deny by default.
- Every request is tenant-scoped unless explicitly platform-level.
- Every mutation has idempotency where retry is possible.
- Every sensitive action emits audit events.
- Every endpoint has authorization tests.
- All errors use consistent shape.
- Do not expose internal database models directly.

## Authentication

Preferred:

- OIDC-compatible identity provider.
- Access tokens.
- Refresh token rotation.
- MFA for privileged roles.

If custom auth exists temporarily:

- Argon2id password hashing.
- Short access token lifetime.
- HttpOnly secure refresh cookies.
- Session revocation.
- Device/session management.

## Authorization

Every endpoint checks:

1. Authenticated user.
2. Tenant membership.
3. Policy decision.
4. Relationship scope.
5. RLS final defense.

Example scopes:

- own
- children
- class
- subject
- stream
- school
- platform

## REST Shape

Resource examples:

- `/api/v1/tenants`
- `/api/v1/users`
- `/api/v1/students`
- `/api/v1/classes`
- `/api/v1/attendance`
- `/api/v1/exams`
- `/api/v1/marks`
- `/api/v1/invoices`
- `/api/v1/payments`
- `/api/v1/notifications`

Command examples:

- `POST /api/v1/marks/{id}/submit`
- `POST /api/v1/marks/{id}/approve`
- `POST /api/v1/payments/{id}/reconcile`
- `POST /api/v1/offline/sync`
- `POST /api/v1/support/access/request`

## BFF Endpoints

Use BFF endpoints for low-bandwidth dashboards:

- `/api/v1/bff/headmaster/dashboard`
- `/api/v1/bff/teacher/today`
- `/api/v1/bff/parent/children`
- `/api/v1/bff/student/home`

BFF endpoints are read-oriented and must still enforce normal policies.

## Idempotency

Required for:

- Payments.
- Offline sync.
- Notification sends.
- Imports.
- Report generation.
- External callbacks.

Use `Idempotency-Key` header for client-initiated mutations.

## Error Shape

Use consistent errors:

```json
{
  "error": {
    "code": "PAYMENT_ALREADY_PROCESSED",
    "message": "This payment has already been processed.",
    "requestId": "req_123",
    "details": {}
  }
}
```

## Pagination

Use cursor pagination for large lists:

- students
- audit events
- payments
- notifications
- ledger entries

## Webhooks

Payment webhooks must:

- Validate provider signature.
- Store raw event safely.
- Deduplicate event.
- Process asynchronously.
- Be idempotent.
- Expose reconciliation status.

## Rate Limits

Rate limits must exist by:

- IP.
- user.
- tenant.
- endpoint.
- action type.
- provider callback.
- AI usage.

