# API Contract Freeze — Platform Operations (ACF-PLAT-001)

| Field     | Value                                                                 |
| --------- | --------------------------------------------------------------------- |
| Freeze ID | `ACF-PLAT-001`                                                        |
| Version   | `1.0`                                                                 |
| Date      | 2026-08-15                                                            |
| Companion | DBF-PLAT-001 · DSF-007                                                |
| Program   | SPEC-PORTALS-001 Phase 1a                                             |
| Authority | Owner GO in session 2026-08-15 (SOLO-GOV-002/003)                     |

**Honesty:** First product HTTP for the Platform Operations bounded context (module was a skeleton — DTOs deliberately deferred until this freeze). Covers tenant lifecycle, manual plans, entitlement flags, and platform audit read. **No** support sessions, **no** metering aggregates, **no** subscription invoicing (later ACFs). SRS AMEND-2026-08-15 covers the scope.

## Scope (v1)

| In scope | Out of scope |
| --- | --- |
| Register tenant + bootstrap initial owner | Support access sessions |
| List/get tenants with lifecycle status | Metering/usage aggregates |
| Suspend / reinstate tenant (reason, audited) | Subscription invoicing/charging |
| List plan catalog; assign plan to tenant | Plan catalog CRUD (stays migrator/ops) |
| Set tenant entitlement flags | Tenant-internal data access (explicit deny) |
| List platform audit events | Feature-flag *catalog* management |

## Actor & auth stack

**Platform operator** (new concept, DBF-PLAT-001 `platform_operators`): a global user granted `super_admin` platform capability. Not a tenant role; holds **no implicit tenant data access** (32 §Explicit Deny).

Stack: Authenticated session → **PlatformOperatorGuard** (active `platform_operators` row, `super_admin`) → **MFA-hard** (session MFA verified; reuse privileged-MFA gate pattern) → RLS platform mode (`app.is_platform_operator = true`, platform-scoped service only). **No `X-Tenant-Id`** on platform routes; sending one is a 400.

All writes emit `audit_events` (append-only) with required `reason` where noted. Suspend/reinstate/plan/entitlement writes are the step-up class: reject unless the session's MFA verification is fresh per existing privileged-MFA policy.

## Endpoints

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/api/v1/platform/tenants` | Cursor list; optional `status` filter. Returns lifecycle, plan code, created/updated. |
| POST | `/api/v1/platform/tenants` | Register school. **Idempotency-Key required.** Body: `code`, `name`, `primaryLocale (en\|sw)`, `timezone`, `owner { email, displayName }`. Creates tenant (`active`), invited owner user (or binds existing user by email), owner membership + system role grant. Audited `platform.tenant.register`. |
| GET | `/api/v1/platform/tenants/{id}` | Detail: profile, status, current plan assignment, entitlements list. |
| POST | `/api/v1/platform/tenants/{id}/suspend` | Body: `reason` (required, 5–500 chars). `active → suspended`. Suspended tenants: product APIs fail closed for tenant members (401/403 path unchanged; tenant status checked at session/tenant bind). Audited `platform.tenant.suspend`. |
| POST | `/api/v1/platform/tenants/{id}/reinstate` | Body: `reason` required. `suspended → active`. Audited `platform.tenant.reinstate`. |
| GET | `/api/v1/platform/plans` | Read existing `plans` catalog (active first). |
| PUT | `/api/v1/platform/tenants/{id}/plan` | Body: `planCode`, `reason` required. Ends current assignment, creates new one (history kept). Audited `platform.tenant.plan_assign`. |
| PUT | `/api/v1/platform/tenants/{id}/entitlements/{code}` | Body: `enabled` (bool), optional `limit` (int ≥ 0), `reason` required. Upsert per (tenant, code). Code allowlist v1: `sms`, `ai`, `payments.momo`, `student_portal`. Audited `platform.tenant.entitlement_set`. |
| GET | `/api/v1/platform/audit` | Cursor list of audit events; optional `tenantId`, `action` filters. Metadata is already redacted at append. |

Response envelope matches existing product APIs (`{ data }`, `{ data, page: { nextCursor, limit } }`; errors via AppError mapper).

## Contract rules

1. Tenant `code` immutable after create; `closed` is terminal (no v1 endpoint sets it — ops/migrator only).
2. Register is transactional: tenant + owner user + membership + role grant all-or-nothing; replay via Idempotency-Key returns the original result.
3. Platform routes never touch tenant-owned tables beyond what registration/lifecycle requires; any tenant-data read beyond `tenants`/assignments is a contract violation (golden test).
4. Existing product tenant routes (`/api/v1/tenants*`) are unchanged by this freeze.
5. OpenAPI additions land with implementation under this freeze's IDs.

## Follow-on ACFs (named, not frozen here)

`ACF-PLAT-002` support sessions · `ACF-PLAT-003` metering aggregates · portal-preference + portal-switch audit (Phase 1b/2 routing ACF).

## Amendments

| Ver | Date | Notes |
| --- | --- | --- |
| 1.0 | 2026-08-15 | Initial Platform Operations product contracts (Phase 1a) |
