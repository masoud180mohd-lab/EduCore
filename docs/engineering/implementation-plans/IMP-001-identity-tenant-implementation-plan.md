# IMP-001: Implementation Plan — Identity & Tenant Slice

## Plan status

| Field             | Value                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------- |
| Plan ID           | `IMP-001`                                                                              |
| Title             | Implementation Plan & Detailed Task Breakdown — Identity & Tenant                      |
| Version           | `1.0`                                                                                  |
| Date              | 2026-07-14                                                                             |
| Authority         | Spec-driven plan under Architecture Freeze v1.0                                        |
| Companion freezes | **DBF-001** (database), **ACF-001** (OpenAPI 3.1)                                      |
| Code status       | **Planning only** — no NestJS controllers, services, or migrations in this deliverable |

### Gate before coding

Implementation tasks in this plan **must not start** until:

1. **DBF-001** is formally accepted (signatures).
2. **ACF-001** is formally accepted (signatures).
3. Task brief / sprint assignment explicitly authorizes the first coding increment.
4. Local Docker Postgres (DEV-001) is available for migration dry-runs.

Optional but recommended: IdP product decision ADR (password-only path may proceed as dual-ready per ACF-001).

### Spec sources (sole product truth for this slice)

| Artifact            | Path                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------- |
| Database freeze     | `docs/engineering/database-freeze/DBF-001-identity-tenant-slice.md`                     |
| API contract freeze | `docs/engineering/api-contract-freeze/ACF-001-identity-tenant-slice.md`                 |
| OpenAPI             | `docs/engineering/api-contract-freeze/openapi/acf-001-identity-tenant.openapi.yaml`     |
| Module boundaries   | PLAT-005 / ADR-001                                                                      |
| Skeleton modules    | `apps/api/src/modules/identity-and-access`, `tenant-and-billing`, `platform-operations` |

---

## 1. Executive summary

This plan converts the **Identity & Tenant** design freezes into a **safe, incremental implementation roadmap** for the NestJS modular monolith. Work is ordered so that:

1. **Persistence and RLS** exist before any business write path.
2. **Request platform** (correlation, error envelope, tenant context, auth middleware) exists before domain routes.
3. **AuthN + session** exist before membership/RBAC-gated APIs.
4. **Tenant provisioning + membership** exist before organization/settings depth.
5. **RBAC** exists before privileged admin mutations.
6. **MFA, relationships, delegations** land as later increments after core isolation is proven.
7. Every increment is **reviewable, testable, and reversible**.

**Non-goals of IMP-001 (the plan itself):** writing application code, applying production schema, building Student/Finance APIs, or PLAT-004 UI.

**Implementation outcome (after all phases coded and accepted):**

- DB tables + RLS for DBF-001 table set.
- HTTP API under `/api/v1` matching ACF-001 OpenAPI.
- AuthZ stack: Authenticated → Active membership → Permission code → Scope → RLS.
- Cursor pagination, error envelope (`requestId`), idempotency for required mutations.
- Contract tests + tenant isolation tests green.
- `npm run check` + boundary checks still pass.

---

## 2. Guiding principles

| Principle        | Application                                                                      |
| ---------------- | -------------------------------------------------------------------------------- |
| Spec-driven      | OpenAPI + DBF-001 are non-negotiable; no shadow fields or routes                 |
| Incremental      | Each phase ships a vertical or platform slice that can be reviewed alone         |
| Fail closed      | Missing tenant/auth/permission → deny; cross-tenant → 404                        |
| Module ownership | Repositories only in owning Nest module; audit via Platform Operations interface |
| Security first   | Every auth/tenant task includes isolation tests and secret hygiene               |
| Small PRs        | Prefer one task ID (or tightly coupled pair) per PR                              |
| Evidence         | Do not claim done without listed tests run                                       |

---

## 3. Implementation phases (6)

| Phase  | Name                            | Goal                                                                                  | Exit signal                                     |
| ------ | ------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **P0** | Readiness & scaffolding         | Tooling, migration runner, DB roles, contract-test harness                            | Can migrate empty DB; OpenAPI loaded in tests   |
| **P1** | Persistence + RLS               | All DBF-001 tables, policies, seeds (permissions)                                     | Isolation tests T1–T8 green on raw SQL/app role |
| **P2** | Request platform                | Correlation, error envelope, tenant context, idempotency store, auth middleware stubs | Health + unauthenticated 401 path consistent    |
| **P3** | AuthN + sessions                | Login (dual-ready), refresh, logout, me, select-tenant, session revoke                | Session lifecycle + token rules verified        |
| **P4** | Tenant core + memberships       | Tenants, orgs, settings, entitlements read, users, memberships                        | Invite + tenant CRUD/list match OpenAPI         |
| **P5** | RBAC + MFA + access foundations | Permissions, roles, user-roles, MFA, relationships, delegations                       | Full ACF-001 surface; permission matrix tests   |
| **P6** | Hardening & slice DoD           | Rate limits, audit completeness, contract suite, docs, rollback drill                 | Slice Definition of Done met                    |

Phases are sequential for **dependencies**; limited parallelization is allowed inside a phase across modules when ownership boundaries are clear (e.g. tenant-and-billing vs identity-and-access after P2).

---

## 4. Recommended build order (what first)

```text
P0 scaffolding
  → P1 migrations + RLS (critical path)
    → P2 request platform (error, tenant header, auth plumbing)
      → P3 auth/session (no RBAC-heavy routes yet)
        → P4 tenants + memberships + users + orgs + settings
          → P5 RBAC + MFA + relationships/delegations
            → P6 hardening + full contract regression
```

**Why this order**

1. Without RLS, every later feature risks tenant leakage.
2. Without error/pagination/idempotency platform, every controller re-implements ACF-001 inconsistently.
3. Without sessions, membership and RBAC cannot be enforced end-to-end.
4. MFA/RBAC after membership avoids circular “need role to invite but need invite to have role” — seed system roles at tenant provision.
5. Hardening last so security tests exercise the full surface.

---

## 5. Detailed task breakdown

Complexity: **S** (<0.5d) · **M** (0.5–1.5d) · **L** (1.5–3d) · **XL** (3d+)

---

### Phase 0 — Readiness & scaffolding

#### IMP-001-T01 — Confirm freeze acceptance gate

| Field               | Content                                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Description         | Record that DBF-001 and ACF-001 are accepted (or block). Create implementation branch policy and link OpenAPI/DBF in PR template for this slice. |
| Dependencies        | Human freeze signatures                                                                                                                          |
| Complexity          | S                                                                                                                                                |
| Acceptance criteria | Written go/no-go; no coding tasks merged without go; PR checklist references ACF-001 + DBF-001                                                   |
| Risks / security    | Starting without acceptance creates thrash and security gaps                                                                                     |

#### IMP-001-T02 — Select and document migration tool

| Field               | Content                                                                                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Description         | Choose migration runner (e.g. node-pg-migrate / Flyway / custom SQL runner) for `apps/api`; document commands in development-environment. **No business tables yet.** |
| Dependencies        | T01, DEV-001 Docker                                                                                                                                                   |
| Complexity          | M                                                                                                                                                                     |
| Acceptance criteria | `npm` scripts for migrate up/down documented; empty baseline migration works; migrator vs app DB roles documented per DBF-001                                         |
| Risks / security    | App must never use migrator/superuser role at runtime                                                                                                                 |

#### IMP-001-T03 — Contract-test harness skeleton

| Field               | Content                                                                                                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Description         | Add test harness that loads ACF-001 OpenAPI and can assert response schemas (e.g. openapi-validator / schemathesis-style checks). Wire to Vitest or dedicated integration suite under `tests/` or `apps/api`. |
| Dependencies        | T01                                                                                                                                                                                                           |
| Complexity          | M                                                                                                                                                                                                             |
| Acceptance criteria | Harness runs in CI/local; fails if sample response violates a known schema fixture; no domain routes required yet                                                                                             |
| Risks / security    | Do not embed secrets in fixtures                                                                                                                                                                              |

#### IMP-001-T04 — Integration test database lifecycle

| Field               | Content                                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Description         | Scripted create/reset of test database (or schema) against Docker Postgres; isolate tests with transactions or truncate between cases. |
| Dependencies        | T02, DEV-001                                                                                                                           |
| Complexity          | M                                                                                                                                      |
| Acceptance criteria | Tests can migrate fresh DB; parallel-safe strategy documented; teardown leaves no credentials in logs                                  |
| Risks / security    | Shared DB pollution; use dedicated test DB name                                                                                        |

---

### Phase 1 — Persistence + RLS

#### IMP-001-T05 — Extensions and global catalogs migration

| Field               | Content                                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Description         | Migrate: required extensions (`citext`, etc.), `permissions`, `plans` per DBF-001. Seed permission codes from DBF-001 §13. |
| Dependencies        | T02, T04                                                                                                                   |
| Complexity          | M                                                                                                                          |
| Acceptance criteria | Tables match DBF-001; seed list exact codes; down migration works on empty data                                            |
| Risks / security    | Permission code typos break AuthZ forever — review against ACF-001                                                         |

#### IMP-001-T06 — Tenants and users root tables

| Field               | Content                                                                          |
| ------------------- | -------------------------------------------------------------------------------- |
| Description         | Migrate `tenants`, `users` with constraints/indexes from DBF-001.                |
| Dependencies        | T05                                                                              |
| Complexity          | M                                                                                |
| Acceptance criteria | Constraints (email unique, tenant code pattern) enforced; no app code yet        |
| Risks / security    | Credential columns (`password_hash`) never selected in default projections later |

#### IMP-001-T07 — Tenant children + memberships

| Field               | Content                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| Description         | Migrate `organizations`, `tenant_settings`, `subscriptions`, `entitlements`, `tenant_memberships`. |
| Dependencies        | T06                                                                                                |
| Complexity          | M                                                                                                  |
| Acceptance criteria | FKs/uniques match freeze; down order correct                                                       |
| Risks / security    | Ensure all tenant-owned tables include `tenant_id`                                                 |

#### IMP-001-T08 — IAM tables (sessions, MFA, RBAC, relationships, delegations)

| Field               | Content                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------- |
| Description         | Migrate `sessions`, `mfa_factors`, `roles`, `role_permissions`, `user_roles`, `relationships`, `delegations`. |
| Dependencies        | T07                                                                                                           |
| Complexity          | L                                                                                                             |
| Acceptance criteria | Unique indexes (incl. user_roles nulls strategy) implemented; session_token_hash unique                       |
| Risks / security    | Token hashes only (never store raw session tokens); MFA secrets column encrypted-at-rest plan documented      |

#### IMP-001-T09 — Audit events table

| Field               | Content                                                                        |
| ------------------- | ------------------------------------------------------------------------------ |
| Description         | Migrate `audit_events` append-oriented; grants deny UPDATE/DELETE to app role. |
| Dependencies        | T06                                                                            |
| Complexity          | S                                                                              |
| Acceptance criteria | App role cannot update/delete; indexes per DBF-001                             |
| Risks / security    | No raw secrets in audit JSON by convention (enforced later in publisher)       |

#### IMP-001-T10 — RLS policies + FORCE RLS

| Field               | Content                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Description         | Enable RLS + FORCE for app role; implement patterns A–E from DBF-001 (tenant-owned, tenants visibility, users, mfa, global catalogs). |
| Dependencies        | T07, T08, T09                                                                                                                         |
| Complexity          | XL                                                                                                                                    |
| Acceptance criteria | Isolation matrix T1–T8 pass with `educore_app` role; missing `app.current_tenant` fails closed                                        |
| Risks / security    | **Highest risk task** — security review mandatory; bypass only migrator role                                                          |

#### IMP-001-T11 — Tenant isolation automated suite

| Field               | Content                                                                   |
| ------------------- | ------------------------------------------------------------------------- |
| Description         | Automate DBF-001 T1–T8 as integration tests (set_config per transaction). |
| Dependencies        | T10, T04                                                                  |
| Complexity          | M                                                                         |
| Acceptance criteria | All T1–T8 automated and green in CI/local; failure blocks merge           |
| Risks / security    | Tests must not disable RLS “to make green”                                |

---

### Phase 2 — Request platform

#### IMP-001-T12 — Error envelope + exception filter (ACF-001)

| Field               | Content                                                                                                                                                                             |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Description         | Align platform filter with ACF-001: `{ error: { code, message, requestId, details? } }`; map domain errors to catalogue; never leak stacks/SQL. Extend PLAT-003 skeleton as needed. |
| Dependencies        | T01                                                                                                                                                                                 |
| Complexity          | M                                                                                                                                                                                   |
| Acceptance criteria | Unit tests for mapping; sample 400/401/403/404/409 bodies match schema                                                                                                              |
| Risks / security    | PII in `message`/`details` forbidden                                                                                                                                                |

#### IMP-001-T13 — Correlation / request ID middleware

| Field               | Content                                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Description         | Accept `X-Correlation-Id`; always emit `X-Correlation-Id` and `X-Request-Id` (may equal). Feed `requestId` in errors. |
| Dependencies        | T12                                                                                                                   |
| Complexity          | S                                                                                                                     |
| Acceptance criteria | Tests prove header propagation on `/health` and error path                                                            |
| Risks / security    | Do not log full auth headers                                                                                          |

#### IMP-001-T14 — Tenant context middleware

| Field               | Content                                                                                                                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Description         | Parse `X-Tenant-Id`; attach to request context; for DB work set `app.current_tenant` transaction-scoped. Reject missing/invalid UUID with `TENANT_CONTEXT_REQUIRED` where required by ACF-001. |
| Dependencies        | T10, T12                                                                                                                                                                                       |
| Complexity          | M                                                                                                                                                                                              |
| Acceptance criteria | Invalid header → 400; context not sticky across requests/pool check                                                                                                                            |
| Risks / security    | **Connection pool contamination** if SET without reset — use transaction-local set_config                                                                                                      |

#### IMP-001-T15 — Idempotency middleware / store

| Field               | Content                                                                                                                                                                                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Description         | Implement `Idempotency-Key` handling for required mutations: store hash of body + route + actor + tenant; 24h replay; mismatch → `IDEMPOTENCY_KEY_REUSE_MISMATCH`. Redis (DEV-001) or DB table (implementation choice documented). |
| Dependencies        | T12, DEV-001 Redis optional                                                                                                                                                                                                        |
| Complexity          | L                                                                                                                                                                                                                                  |
| Acceptance criteria | Contract tests for required-key missing, replay, mismatch; no key → `IDEMPOTENCY_KEY_REQUIRED` where mandated                                                                                                                      |
| Risks / security    | Keys scoped correctly to prevent cross-tenant replay                                                                                                                                                                               |

#### IMP-001-T16 — Cursor pagination helpers

| Field               | Content                                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Description         | Shared helpers for `limit`/`cursor` query and `{ data, page: { nextCursor, limit } }` responses; opaque cursors (signed or DB keyset). |
| Dependencies        | T12                                                                                                                                    |
| Complexity          | M                                                                                                                                      |
| Acceptance criteria | Unit tests for bounds (1–100 default 25); stable ordering documented                                                                   |
| Risks / security    | Cursors must not expose other tenants’ keys                                                                                            |

#### IMP-001-T17 — AuthN plumbing (token validation interface)

| Field               | Content                                                                                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Description         | Define session/access-token validation interface (OIDC or local session lookup) with deny-by-default guard. No full login yet if split, but Bearer extraction ready. |
| Dependencies        | T08, T12                                                                                                                                                             |
| Complexity          | M                                                                                                                                                                    |
| Acceptance criteria | Missing Bearer → 401 `UNAUTHORIZED`; revoked session rejected when sessions exist                                                                                    |
| Risks / security    | Algorithm confusion / weak JWT config — pin algorithms; prefer opaque server sessions if dual-ready                                                                  |

#### IMP-001-T18 — Authorization policy evaluator

| Field               | Content                                                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Description         | Implement permission check: load membership + roles + permissions for (user, tenant); optional org scope; explicit deny default. |
| Dependencies        | T08, T14, T17                                                                                                                    |
| Complexity          | L                                                                                                                                |
| Acceptance criteria | Unit tests: no membership → `TENANT_MEMBERSHIP_REQUIRED`/`FORBIDDEN`; missing permission → 403; happy path allows                |
| Risks / security    | Cache must be tenant-scoped; no global user permission cache without tenant key                                                  |

#### IMP-001-T19 — Audit publisher interface (platform-operations)

| Field               | Content                                                                                                                             |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Description         | Public interface in platform-operations to append `audit_events` (redacted). Identity/tenant modules call interface only (ADR-001). |
| Dependencies        | T09, T14                                                                                                                            |
| Complexity          | M                                                                                                                                   |
| Acceptance criteria | Insert works under RLS; other modules cannot import audit repository internals (boundary check)                                     |
| Risks / security    | Redaction unit tests for password/token fields                                                                                      |

---

### Phase 3 — AuthN + sessions

#### IMP-001-T20 — POST `/auth/login` (dual-ready)

| Field               | Content                                                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Description         | Implement login per OpenAPI: password and/or `idpAssertion` path; return tokens or MFA challenge; generic `INVALID_CREDENTIALS`. |
| Dependencies        | T17, T12, T15 (N/A), T19                                                                                                         |
| Complexity          | L                                                                                                                                |
| Acceptance criteria | OpenAPI response validates; rate-limit hook placeholder; no user enumeration in messages; audit login success/failure (redacted) |
| Risks / security    | Timing-safe password compare; Argon2id if passwords; lockout policy document                                                     |

#### IMP-001-T21 — POST `/auth/mfa/verify`

| Field               | Content                                                                     |
| ------------------- | --------------------------------------------------------------------------- |
| Description         | Complete MFA challenge; issue session on success; `MFA_INVALID` on failure. |
| Dependencies        | T20, T08                                                                    |
| Complexity          | M                                                                           |
| Acceptance criteria | OpenAPI match; challenge token single-use; rate limited                     |
| Risks / security    | Brute-force on codes                                                        |

#### IMP-001-T22 — POST `/auth/refresh` + `/auth/logout`

| Field               | Content                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------- |
| Description         | Refresh rotation; logout revokes session. Prefer refresh HttpOnly cookie path for web.  |
| Dependencies        | T20                                                                                     |
| Complexity          | M                                                                                       |
| Acceptance criteria | Refresh reuse detection strategy documented; logout 204; revoked session cannot refresh |
| Risks / security    | Refresh token theft — rotation + revoke family                                          |

#### IMP-001-T23 — GET `/auth/me` + POST `/auth/select-tenant`

| Field               | Content                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| Description         | Me returns user + memberships; select-tenant binds active tenant when membership active.        |
| Dependencies        | T18, T20                                                                                        |
| Complexity          | M                                                                                               |
| Acceptance criteria | OpenAPI match; suspended tenant/membership denied; permissions listed after select if specified |
| Risks / security    | Do not return memberships for removed tenants as active                                         |

#### IMP-001-T24 — Sessions list + revoke

| Field               | Content                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------- |
| Description         | `GET /sessions`, `POST /sessions/{id}/revoke` — self by default; `session.revoke` for others. |
| Dependencies        | T18, T20, T16                                                                                 |
| Complexity          | M                                                                                             |
| Acceptance criteria | Cursor page shape; cross-user revoke without permission → 403/404; audit revoke               |
| Risks / security    | Session fixation / listing other users’ IPs without permission                                |

---

### Phase 4 — Tenant core + memberships + users + orgs

#### IMP-001-T25 — Tenant create + get + patch + current

| Field               | Content                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Description         | Implement tenant routes in **tenant-and-billing** module; platform/bootstrap authorization for create; seed system roles + owner membership on create. |
| Dependencies        | T14–T19, T10                                                                                                                                           |
| Complexity          | L                                                                                                                                                      |
| Acceptance criteria | OpenAPI; idempotent create; code uniqueness → 409; owner can `tenant.read`                                                                             |
| Risks / security    | Bootstrap auth must not be open in production configs                                                                                                  |

#### IMP-001-T26 — Organizations CRUD-lite + deactivate

| Field               | Content                                                                            |
| ------------------- | ---------------------------------------------------------------------------------- |
| Description         | List/create/get/patch/deactivate with `organization.read` / `organization.manage`. |
| Dependencies        | T25, T16, T18                                                                      |
| Complexity          | M                                                                                  |
| Acceptance criteria | Cursor list; tenant isolation; OpenAPI schemas                                     |
| Risks / security    | Cross-tenant org id → 404                                                          |

#### IMP-001-T27 — Tenant settings get/put + entitlements/subscription read

| Field               | Content                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| Description         | Settings schemaVersion validation; unknown keys rejected; entitlements list; current subscription. |
| Dependencies        | T25, T16                                                                                           |
| Complexity          | M                                                                                                  |
| Acceptance criteria | Validation errors use `VALIDATION_ERROR`; OpenAPI match                                            |
| Risks / security    | Settings must not store secrets in plain form without encryption policy                            |

#### IMP-001-T28 — Users list/get/patch/disable

| Field               | Content                                                                             |
| ------------------- | ----------------------------------------------------------------------------------- |
| Description         | Users visible via membership; self patch limited fields; `user.manage` for disable. |
| Dependencies        | T18, T16, T23                                                                       |
| Complexity          | M                                                                                   |
| Acceptance criteria | OpenAPI; never return passwordHash; disable audited                                 |
| Risks / security    | Privilege escalation via patch                                                      |

#### IMP-001-T29 — Memberships invite lifecycle

| Field               | Content                                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Description         | List/create/get/suspend/reactivate/remove; invite by email creates/finds user; optional `roleCodes`; **Idempotency-Key required** on create. |
| Dependencies        | T25, T18, T15, T19                                                                                                                           |
| Complexity          | L                                                                                                                                            |
| Acceptance criteria | Full OpenAPI membership flows; duplicate membership → 409; audit invite/suspend/remove                                                       |
| Risks / security    | Invite flooding — rate limit; email enumeration mitigated                                                                                    |

---

### Phase 5 — RBAC + MFA + relationships + delegations

#### IMP-001-T30 — Permissions catalog + roles API

| Field               | Content                                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Description         | `GET /permissions`; roles list/create/get/patch; `PUT .../permissions` replace set; system roles immutable codes. |
| Dependencies        | T18, T16, T05                                                                                                     |
| Complexity          | L                                                                                                                 |
| Acceptance criteria | OpenAPI; `role.manage` enforced; cannot delete system role codes                                                  |
| Risks / security    | Over-permissioned custom roles — only assign known permission codes                                               |

#### IMP-001-T31 — User-role assign/unassign

| Field               | Content                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------- |
| Description         | `GET/POST /user-roles`, `DELETE /user-roles/{id}` with optional `organizationId` scope. |
| Dependencies        | T30, T15                                                                                |
| Complexity          | M                                                                                       |
| Acceptance criteria | Idempotent assign; unique conflict 409; AuthZ uses new assignments immediately          |
| Risks / security    | Self-elevation — require `role.manage`; protect last owner role                         |

#### IMP-001-T32 — MFA factors self-service

| Field               | Content                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| Description         | List/begin/confirm/disable per OpenAPI; one-time setup payload only on begin; secrets encrypted. |
| Dependencies        | T21, T15                                                                                         |
| Complexity          | L                                                                                                |
| Acceptance criteria | OpenAPI; secrets never re-exposed; disable audited                                               |
| Risks / security    | Secret leakage in logs; SMS OTP as weaker factor — flag for prod policy                          |

#### IMP-001-T33 — Relationships (objectType=user only)

| Field               | Content                                                                         |
| ------------------- | ------------------------------------------------------------------------------- |
| Description         | List/create/end; reject non-`user` objectType with validation error in slice 1. |
| Dependencies        | T18, T16                                                                        |
| Complexity          | M                                                                               |
| Acceptance criteria | OpenAPI; tenant isolation; future object types blocked                          |
| Risks / security    | Forged objectId for other tenants — still tenant_id RLS                         |

#### IMP-001-T34 — Delegations create/list/revoke

| Field               | Content                                                    |
| ------------------- | ---------------------------------------------------------- |
| Description         | Time-bound delegations with reason/scope; revoke path.     |
| Dependencies        | T18, T19                                                   |
| Complexity          | M                                                          |
| Acceptance criteria | Expired delegations not authorized; reason required; audit |
| Risks / security    | Over-broad scope_json — validate allowlisted scope keys    |

---

### Phase 6 — Hardening & Definition of Done

#### IMP-001-T35 — Rate limiting on auth and invite

| Field               | Content                                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| Description         | Apply limits to login, MFA verify, invite (IP + user + tenant dimensions per kit). Exact numbers configurable. |
| Dependencies        | T20, T29                                                                                                       |
| Complexity          | M                                                                                                              |
| Acceptance criteria | Exceed → 429 `RATE_LIMITED` with envelope; config documented                                                   |
| Risks / security    | DoS without limits; shared IP false positives                                                                  |

#### IMP-001-T36 — Full OpenAPI contract suite

| Field               | Content                                                                           |
| ------------------- | --------------------------------------------------------------------------------- |
| Description         | Contract tests for all ACF-001 operations (happy + representative errors).        |
| Dependencies        | T20–T34, T03                                                                      |
| Complexity          | XL                                                                                |
| Acceptance criteria | Suite green; fails on schema drift; CI job or `npm run test` inclusion documented |
| Risks / security    | Fixtures with real-looking secrets forbidden                                      |

#### IMP-001-T37 — Permission matrix golden tests

| Field               | Content                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------ |
| Description         | Matrix: roles × endpoints (allow/deny) for owner/admin/staff/unauthenticated/other-tenant. |
| Dependencies        | T31, T36                                                                                   |
| Complexity          | L                                                                                          |
| Acceptance criteria | Documented matrix; automated; matches ACF-001 AuthZ                                        |
| Risks / security    | Gaps in matrix = production holes                                                          |

#### IMP-001-T38 — Security review checklist pass

| Field               | Content                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Description         | Checklist: RLS forced, no raw tokens logged, cookies flags, CORS plan, bootstrap auth disabled in prod config, boundary check clean. |
| Dependencies        | T36, T37                                                                                                                             |
| Complexity          | M                                                                                                                                    |
| Acceptance criteria | Written security review notes attached to slice release record                                                                       |
| Risks / security    | Rubber-stamp reviews                                                                                                                 |

#### IMP-001-T39 — Migration rollback drill

| Field               | Content                                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------------------- |
| Description         | On disposable DB: migrate up full slice → down to empty (or documented restore). Record timing and issues. |
| Dependencies        | T10                                                                                                        |
| Complexity          | M                                                                                                          |
| Acceptance criteria | Drill notes in task record; known irreversible steps listed (none preferred pre-prod)                      |
| Risks / security    | Accidental production down — drill only non-prod                                                           |

#### IMP-001-T40 — Slice documentation + handoff

| Field               | Content                                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Description         | Update engineering docs: how to run migrations, seed, test matrix; mark IMP-001 implementation complete only when DoD met. |
| Dependencies        | T36–T39                                                                                                                    |
| Complexity          | S                                                                                                                          |
| Acceptance criteria | README/dev-env updated; open questions residual listed                                                                     |
| Risks / security    | Docs drift from OpenAPI — link OpenAPI as source of truth                                                                  |

---

## 6. Testing strategy

| Layer              | What                                                                       | When                   |
| ------------------ | -------------------------------------------------------------------------- | ---------------------- |
| Unit               | Policy evaluator, password hashing, cursor codec, error mapping, redaction | From P2 onward         |
| Integration (DB)   | Migrations, RLS T1–T8, FK/uniques                                          | P1                     |
| Integration (HTTP) | Auth flows, membership, RBAC with real DB                                  | P3–P5                  |
| Contract           | Response/request vs OpenAPI 3.1                                            | P0 harness; full in P6 |
| Security           | Isolation, permission matrix, rate limit, session revoke                   | P6                     |
| Boundary           | PLAT-005 `boundaries:check` every PR                                       | Always                 |
| Quality gate       | `npm run check`                                                            | Always                 |

### Minimum isolation scenarios (must automate)

1. Tenant A cannot read Tenant B organizations/users/sessions.
2. No `X-Tenant-Id` on tenant route → 400.
3. User without membership → 403.
4. User without permission → 403.
5. Cross-tenant resource id → 404.
6. Idempotent invite replay returns same result.
7. Revoked session cannot call `/auth/me`.
8. Platform operator path (if any) audited.

---

## 7. Migration & rollback strategy

| Stage              | Action                                                                 |
| ------------------ | ---------------------------------------------------------------------- |
| Dev                | Expand with ordered migrations (DBF-001 §12.2); each PR reverse-tested |
| Pre-prod           | Full up on clean DB; run isolation + contract suites                   |
| Rollback pre-data  | `migrate down` chain to prior tag                                      |
| Rollback with data | Prefer forward-fix; PITR from DEV/staging snapshots                    |
| RLS hotfix         | Additive policy migration; keep fail-closed defaults                   |
| Forbidden          | Hand-editing prod; app using superuser; disabling RLS to ship          |

App runtime role: **`educore_app`** with FORCE RLS.  
Migrations: **`educore_migrator`** only in migrate jobs.

---

## 8. Module ownership during implementation

| Work                                                            | Module                                                      | Public barrel exports                               |
| --------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------- |
| Auth, users, memberships, RBAC, MFA, relationships, delegations | `identity-and-access`                                       | Module + application services needed by composition |
| Tenants, orgs, settings, entitlements, subscriptions            | `tenant-and-billing`                                        | Same                                                |
| Audit append                                                    | `platform-operations`                                       | Audit publisher interface only                      |
| HTTP wiring                                                     | `apps/api` composition / thin controllers in owning modules | Controllers not imported cross-module               |

Cross-module collaboration: **interfaces / domain events only** (e.g. tenant provision calls identity to create owner membership via application service API, not SQL).

---

## 9. Definition of Done (entire Identity & Tenant slice)

The slice is **Done** only when all are true:

1. **Gates:** DBF-001 + ACF-001 formally accepted; implementation authorized.
2. **Schema:** All DBF-001 tables present; RLS FORCE on app role; T1–T8 automated green.
3. **API:** All ACF-001 operations implemented or explicitly deferred with freeze amendment (no silent skips).
4. **AuthZ:** Authenticated → membership → permission → scope enforced; matrix tests green.
5. **Cross-cutting:** Error envelope, cursor pagination, idempotency rules, correlation headers match ACF-001.
6. **Security:** No secrets in logs/responses; session/MFA material hashed/encrypted; rate limits on auth/invite; security review signed.
7. **Quality:** `npm run check` green; PLAT-005 boundaries green; OpenAPI contract suite green.
8. **Ops:** Migrate up/down documented; rollback drill recorded; runbooks for session revoke / tenant suspend.
9. **Scope control:** No Student/Finance/Attendance routes or tables introduced.
10. **Handoff:** IMP-001 completion record updated; residual risks listed.

---

## 10. Risks register (plan-level)

| Risk                             | Impact                  | Mitigation                               |
| -------------------------------- | ----------------------- | ---------------------------------------- |
| Coding before freeze acceptance  | Rework, security holes  | T01 hard gate                            |
| RLS defect                       | Cross-tenant breach     | T10/T11 + mandatory security review      |
| IdP indecision                   | Auth thrash             | Dual-ready login; ADR when product picks |
| Idempotency store multi-instance | Duplicate invites       | Redis/DB shared store; key scope         |
| Over-scoped Phase 5              | Delayed isolation proof | Do not skip P1–P4 tests                  |
| Last owner role removal          | Tenant lockout          | Guard in T31                             |
| OpenAPI drift                    | Client break            | Contract suite T36                       |

---

## 11. Explicit non-goals

- NestJS code, migrations, or entities **in this planning deliverable**
- Student Registry / Finance / Attendance implementation
- Design System / PLAT-004 UI
- Production cloud topology / hosted IdP procurement
- Full billing metering APIs
- GraphQL / BFF dashboards

---

## 12. Approval & revision

| Role                | Name | Date | Signature |
| ------------------- | ---- | ---- | --------- |
| Principal Architect |      |      |           |
| Backend Lead        |      |      |           |
| Security            |      |      |           |
| QA Lead             |      |      |           |

| Version | Date       | Notes                                         |
| ------- | ---------- | --------------------------------------------- |
| 1.0     | 2026-07-14 | Initial Identity & Tenant implementation plan |

---

## 13. Next step after this plan

1. Obtain **formal acceptance** of DBF-001 + ACF-001 (if not already signed).
2. Approve **IMP-001** (this plan).
3. Start coding at **IMP-001-T01 → T02** (migration tooling) then **P1 RLS-critical path**.
4. Optionally parallel: Design System Freeze for admin shell (does not block backend P0–P2).
