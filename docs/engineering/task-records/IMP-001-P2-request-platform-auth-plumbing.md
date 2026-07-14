# IMP-001 Phase P2 — Request Platform & Auth Plumbing

## Outcome

Deliver the **request platform foundation** under **conditional freeze** (ADR-012): ACF-aligned error envelope + dual correlation headers, tenant context middleware, auth plumbing (token validation interface), policy evaluator foundation, audit publisher interface, and idempotency/pagination helpers.

**No business HTTP routes** (login, tenant/user CRUD, sessions) were opened.

## Status

**Complete** (platform plumbing only; conditional freeze still applies).

## Scope delivered

| Task (IMP-001) | Deliverable                                                              |
| -------------- | ------------------------------------------------------------------------ |
| T12            | Error envelope `{ error: { code, message, requestId, details? } }`       |
| T13            | `X-Correlation-Id` + `X-Request-Id` always emitted; feed `requestId`     |
| T14            | `X-Tenant-Id` parse/validate UUID; membership checker interface          |
| T15            | Idempotency helpers + in-memory store (no mutation routes yet)           |
| T16            | Cursor pagination helpers (limit 1–100, default 25)                      |
| T17            | `TokenValidator`, Bearer extract, auth middleware, fail-closed default   |
| T18            | `PolicyEvaluator` + permission codes + `RequirePermission` guard factory |
| T19            | `AuditPublisher` in platform-operations public barrel + redaction        |

## Files (primary)

### Platform common

- `apps/api/src/common/errors/*` — AppError codes, envelope, filter
- `apps/api/src/common/correlation/*` — dual headers
- `apps/api/src/common/tenant/*` — tenant context middleware + membership checker
- `apps/api/src/common/auth/*` — token validator, middleware, guards
- `apps/api/src/common/policy/*` — permission catalogue + evaluator
- `apps/api/src/common/idempotency/*`
- `apps/api/src/common/pagination/*`
- `apps/api/src/common/request-platform/request-platform.module.ts`

### Platform operations

- `apps/api/src/modules/platform-operations/audit/audit-publisher.ts`
- Barrel export of `AUDIT_PUBLISHER` / types

### Wiring

- `apps/api/src/app.module.ts` — middleware order: correlation → auth → tenant

## Security & isolation

| Control                     | Behaviour                                                                    |
| --------------------------- | ---------------------------------------------------------------------------- |
| Token validation default    | `RejectAllTokenValidator` (deny-by-default)                                  |
| Membership default          | `DenyAllTenantMembershipChecker`                                             |
| Permissions default         | `EmptyPermissionSource`                                                      |
| Invalid Bearer when present | `401 UNAUTHORIZED` (even on public health — fail-closed on bad credentials)  |
| Invalid `X-Tenant-Id`       | `400 TENANT_CONTEXT_REQUIRED`                                                |
| DB GUC                      | **Not** set in middleware (avoids pool contamination); helper SQL documented |
| Audit metadata              | Redacts password/token/secret keys                                           |
| Error body                  | No stacks, no SQL, no secrets; `requestId` only                              |
| Business routes             | Still empty controllers                                                      |

## Explicit non-goals confirmed

- No login / MFA / refresh / logout routes
- No tenant or user CRUD HTTP endpoints
- No sessions table migration
- No production JWT/OIDC provider (interface only)
- No Redis/DB-backed idempotency store

## Skills applied

| Skill                       | Use                                            |
| --------------------------- | ---------------------------------------------- |
| planning-and-task-breakdown | `tasks/plan-p2-request-platform.md`            |
| spec-driven-development     | ACF-001 headers, errors, permissions           |
| incremental-implementation  | Errors → auth/tenant → policy/audit → tests    |
| api-and-interface-design    | Public tokens/interfaces for later routes      |
| security-and-hardening      | Fail-closed defaults, redaction, no GUC sticky |
| code-review-and-quality     | Unit + structural + smoke tests                |
| documentation-and-adrs      | This task record + plan                        |

## Verification

```bash
npm run check
npm run boundaries:check
```

## Recommended next step

1. Keep conditional freeze until human DBF/ACF signatures (or continue under ADR-012).
2. **P3 AuthN** only after GO: sessions model + `TokenValidator` implementation + login (still gated).
3. ~~Wire real membership checker against `tenant_memberships` when DB pool lands in Nest.~~ → done in `IMP-001-P2-membership-db-integration.md`.
4. Persist audit via outbox → `audit_events` under RLS.
5. Nest-backed role permission catalogue (`PermissionSource`) when Identity roles tables are in scope.
