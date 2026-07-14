# Implementation Plan: IMP-001 Phase P2 — Request Platform & Auth Plumbing

## Overview

Build the **request platform foundation** under **conditional freeze** (ADR-012): error envelope alignment with ACF-001, correlation/request IDs, tenant context middleware, auth plumbing (token validation interface + deny-by-default), policy evaluator foundation, audit publisher interface, and optional idempotency/pagination helpers.

**Explicit non-goals:** No login/MFA/refresh, no tenant/user CRUD HTTP routes, no sessions table, no large schema changes.

## Architecture Decisions

1. **Platform lives in `apps/api/src/common/**`** for cross-cutting concerns; **AuditPublisher** public interface lives in **platform-operations** (ADR-001 / T19).
2. **Fail-closed defaults:** `RejectAllTokenValidator`, empty permission source, membership checker returns false unless injected otherwise.
3. **Error envelope:** ACF-001 canonical field is `requestId` (maps from correlation/request id). Drop client-facing `correlationId` in body; keep dual **headers** `X-Correlation-Id` + `X-Request-Id`.
4. **No sticky DB GUC in middleware:** Tenant middleware only attaches validated UUID to request. GUC `app.current_tenant` / `app.current_user` is set later **transaction-scoped** via a helper (documented, not pool-sticky).
5. **Guards over global hard-auth:** Middleware enriches context; `RequireAuth` / `RequireTenant` / `RequirePermission` guards exist for future routes. Health stays public.
6. **No business HTTP routes** in this phase.

## Dependency Graph

```
Error envelope (T12)
    → Correlation dual headers (T13)
        → Tenant context middleware (T14)
        → Auth plumbing (T17)
            → Policy evaluator (T18)
        → Audit publisher interface (T19)
Idempotency helpers (T15) ─┐ independent of routes
Pagination helpers (T16) ──┘
```

## Task List

### Phase A — Errors & correlation

- [x] Task A1: Align `ErrorEnvelope` to ACF (`requestId`) + expand platform error codes
- [x] Task A2: Dual `X-Correlation-Id` / `X-Request-Id` middleware + filter wiring

### Phase B — Tenant & auth

- [x] Task B1: Tenant context types + middleware (UUID validation)
- [x] Task B2: Auth principal, TokenValidator, Bearer extract, middleware
- [x] Task B3: Membership checker interface + Require* guards

### Phase C — Policy, audit, helpers

- [x] Task C1: Permission codes + PolicyEvaluator foundation
- [x] Task C2: AuditPublisher in platform-operations (+ redaction)
- [x] Task C3: Idempotency + cursor pagination helpers

### Phase D — Wire, test, document

- [x] Task D1: RequestPlatformModule + AppModule middleware order
- [x] Task D2: Unit + structural tests; smoke updates
- [x] Task D3: Task record + `npm run check` / `boundaries:check`

## Risks and Mitigations

| Risk                         | Impact | Mitigation                                      |
| ---------------------------- | ------ | ----------------------------------------------- |
| Pool GUC contamination       | High   | No SET in middleware; doc transaction-local API |
| Premature JWT complexity     | Medium | Interface + reject-all default                  |
| Opening business routes      | High   | Controllers remain empty; health only           |
| Cross-module boundary breach | High   | Audit via public barrel only                    |

## Open Questions

- Real session/token store (P3) vs opaque sessions vs OIDC — deferred.
- Idempotency persistence: Redis vs DB table — in-memory helper only for P2.
