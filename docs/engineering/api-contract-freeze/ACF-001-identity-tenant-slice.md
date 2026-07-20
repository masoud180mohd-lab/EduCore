# API Contract Freeze v1.0 — Identity & Tenant Slice (ACF-001)

## Freeze status

| Field            | Value                                                                               |
| ---------------- | ----------------------------------------------------------------------------------- |
| Freeze ID        | `ACF-001`                                                                           |
| Title            | API Contract Freeze — Identity & Tenant / Organization slice                        |
| Version          | `1.0` (**conditional** acceptance — OpenAPI hardened with security + x-permissions) |
| Date             | 2026-07-14                                                                          |
| Authority        | Engineering design freeze under Architecture Freeze v1.0                            |
| Companion        | `DBF-001` (Database Freeze — Identity & Tenant)                                     |
| Transport        | REST JSON over HTTPS                                                                |
| Base path        | `/api/v1`                                                                           |
| OpenAPI artifact | `docs/engineering/api-contract-freeze/openapi/acf-001-identity-tenant.openapi.yaml` |

**This document freezes public HTTP contracts for the first vertical slice only.**  
It does **not** authorize NestJS controllers, services, migrations, or ORM entities until **DBF-001** and **ACF-001** are formally accepted (and Design System Freeze for any production UI).

---

## 1. Purpose

Define stable, reviewable API contracts for:

1. Tenant lifecycle and organizations
2. Users and tenant memberships
3. Authentication / session lifecycle (high-level; IdP product still flexible)
4. RBAC (permissions catalog, roles, assignments)
5. MFA factor management (high-level)
6. Shared error, pagination, idempotency, and authorization rules

Aligned with:

- `EduCore/06_API_SPECIFICATION.md`
- `EduCore/35_PROJECT_ARCHITECTURE.md`
- `docs/engineering/database-freeze/DBF-001-identity-tenant-slice.md`
- ADR-001 modular monolith (BFF later; this freeze is resource API first)

---

## 2. Scope

### In scope

| Domain              | Resources                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------- |
| Tenant And Billing  | Tenants, Organizations, Tenant Settings, Entitlements (read), Subscriptions (read baseline) |
| Identity And Access | Users, Memberships, Sessions/Auth, Roles, Permissions, User Roles, MFA factors              |
| Cross-cutting       | Error envelope, pagination, idempotency, correlation headers, authz requirements            |

### Out of scope

- Student, Academic, Attendance, Assessment, Finance, Payments, Notifications, AI APIs
- Role-specific BFF dashboards (`/bff/*`) — later slice
- Webhooks
- GraphQL
- Platform support break-glass admin console APIs (except permission hooks noted)
- Exact OIDC discovery document of a vendor IdP

---

## 3. Global conventions (frozen)

### 3.1 Versioning & media types

| Item         | Rule                                                                  |
| ------------ | --------------------------------------------------------------------- |
| URL version  | `/api/v1/...`                                                         |
| Content-Type | `application/json; charset=utf-8`                                     |
| Accept       | `application/json`                                                    |
| Resource IDs | UUID v7 strings                                                       |
| Timestamps   | ISO-8601 UTC (`2026-07-14T12:00:00.000Z`)                             |
| Field naming | `camelCase` in JSON (maps from DB `snake_case`)                       |
| Nulls        | Omitted optional fields preferred; explicit `null` only when clearing |

### 3.2 Headers

| Header             | Required                           | Purpose                                                           |
| ------------------ | ---------------------------------- | ----------------------------------------------------------------- |
| `Authorization`    | Yes (except auth bootstrap routes) | `Bearer <access_token>`                                           |
| `X-Tenant-Id`      | Yes for tenant-scoped routes       | Active tenant UUID; must match membership                         |
| `X-Correlation-Id` | Optional                           | Client correlation; server always returns one                     |
| `Idempotency-Key`  | Required for listed mutations      | UUID or opaque 16–128 char key                                    |
| `X-Request-Id`     | Response                           | Echo/correlation for support (same as correlation when not split) |

Server always responds with:

- `X-Correlation-Id: <uuid>`
- `X-Request-Id: <uuid>` (may equal correlation id)

### 3.3 Tenant scoping

- Every tenant-scoped endpoint requires authenticated user + **active membership** on `X-Tenant-Id`.
- Platform-level routes (tenant provisioning bootstrap) use separate security schemes and must not accept arbitrary tenant headers without platform role.
- Never accept `tenantId` from body to override header for authorization (body may include tenant only for create bootstrap).

### 3.4 Pagination (cursor)

Frozen standard for list endpoints:

**Request query**

| Param    | Type    | Default | Notes                            |
| -------- | ------- | ------- | -------------------------------- |
| `limit`  | integer | 25      | Min 1, max 100                   |
| `cursor` | string  | —       | Opaque server cursor             |
| `status` | string  | —       | Optional filter where documented |

**Response**

```json
{
  "data": [/* resource objects */],
  "page": {
    "nextCursor": "opaque-or-null",
    "limit": 25
  }
}
```

No offset pagination in this slice.

### 3.5 Idempotency

| Mutation class                  | `Idempotency-Key`                 |
| ------------------------------- | --------------------------------- |
| Create tenant                   | Required                          |
| Invite user / create membership | Required                          |
| Assign role                     | Required                          |
| Login / refresh / logout        | Not required (auth flow specific) |
| Revoke session                  | Recommended                       |
| Register MFA                    | Required                          |
| Update settings                 | Recommended                       |

Rules:

- Key scoped to `(actorUserId, tenantId|platform, route, method)`.
- Replay within 24h returns **same status + body** as original success.
- Conflict on same key with different body → `409 IDEMPOTENCY_KEY_REUSE_MISMATCH`.

### 3.6 Authorization model (every endpoint)

Layered checks (Access Control Bible):

1. Authentication (valid session/token)
2. Tenant membership (`active`) when tenant-scoped
3. Permission code(s) from RBAC
4. Relationship / organization scope when noted
5. RLS final defense at DB

Permission codes (from DBF-001):

`tenant.read`, `tenant.manage`, `organization.read`, `organization.manage`, `user.invite`, `user.read`, `user.manage`, `role.read`, `role.manage`, `session.revoke`, `audit.read`, `entitlement.read`, `entitlement.manage`

### 3.7 Error contract (frozen)

Aligns with kit error shape; `requestId` is canonical (maps from correlation id).

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable, non-sensitive summary.",
    "requestId": "0193f0c2-7c2a-7b1e-9c1d-5f2e1a0b9c8d",
    "details": {
      "fields": [{ "path": "email", "issue": "invalid_format" }]
    }
  }
}
```

| Rule          | Value                                   |
| ------------- | --------------------------------------- |
| Top-level key | `error` only (no stack, no SQL)         |
| `code`        | Stable machine code (`SCREAMING_SNAKE`) |
| `message`     | Safe for UI; no secrets/PII dumps       |
| `requestId`   | Always present                          |
| `details`     | Optional; structured, redacted          |
| HTTP mapping  | See catalogue below                     |

#### HTTP status mapping

| HTTP | When                                                   |
| ---- | ------------------------------------------------------ |
| 400  | Malformed JSON / validation                            |
| 401  | Missing/invalid auth                                   |
| 403  | Authenticated but not allowed                          |
| 404  | Resource not visible or missing (no cross-tenant leak) |
| 409  | Conflict / idempotency mismatch / duplicate            |
| 422  | Semantic domain rule failure                           |
| 429  | Rate limited                                           |
| 500  | Unexpected (generic message)                           |

#### Error codes (slice catalogue)

| Code                             | HTTP    | Meaning                            |
| -------------------------------- | ------- | ---------------------------------- |
| `VALIDATION_ERROR`               | 400     | Input schema failed                |
| `UNAUTHORIZED`                   | 401     | Not authenticated                  |
| `FORBIDDEN`                      | 403     | Missing permission / membership    |
| `TENANT_CONTEXT_REQUIRED`        | 400     | Missing/invalid `X-Tenant-Id`      |
| `TENANT_MEMBERSHIP_REQUIRED`     | 403     | No active membership               |
| `NOT_FOUND`                      | 404     | Resource not found in scope        |
| `CONFLICT`                       | 409     | Unique constraint / state conflict |
| `IDEMPOTENCY_KEY_REUSE_MISMATCH` | 409     | Same key, different payload        |
| `IDEMPOTENCY_KEY_REQUIRED`       | 400     | Missing required key               |
| `INVALID_CREDENTIALS`            | 401     | Login failed (generic)             |
| `MFA_REQUIRED`                   | 401/403 | Step-up MFA needed                 |
| `MFA_INVALID`                    | 401     | Bad MFA challenge                  |
| `SESSION_REVOKED`                | 401     | Session no longer valid            |
| `ACCOUNT_DISABLED`               | 403     | User status blocks action          |
| `TENANT_SUSPENDED`               | 403     | Tenant not active                  |
| `RATE_LIMITED`                   | 429     | Too many requests                  |
| `INTERNAL_ERROR`                 | 500     | Unexpected                         |

Cross-tenant access always returns `404 NOT_FOUND` or `403 FORBIDDEN` without confirming existence in other tenants (prefer **404** for resource-by-id).

---

## 4. Resource contracts (summary)

Full request/response schemas: OpenAPI file.  
Below: method, path, auth, permission, notes.

### 4.1 Authentication & sessions (high-level)

IdP product is **not** frozen. These routes define the platform session boundary the modular monolith exposes to clients (BFF/web). External OIDC may replace password login later without changing tenant/user resource shapes.

| Method | Path                                  | Auth               | Permission               | Idempotency | Description                                                      |
| ------ | ------------------------------------- | ------------------ | ------------------------ | ----------- | ---------------------------------------------------------------- |
| `POST` | `/api/v1/auth/login`                  | Public             | —                        | No          | Password or IdP exchange → session tokens (design allows either) |
| `POST` | `/api/v1/auth/refresh`                | Refresh credential | —                        | No          | Rotate access token                                              |
| `POST` | `/api/v1/auth/logout`                 | Bearer             | —                        | No          | Revoke current session                                           |
| `GET`  | `/api/v1/auth/me`                     | Bearer             | —                        | —           | Current user + memberships summary                               |
| `POST` | `/api/v1/auth/select-tenant`          | Bearer             | membership               | Recommended | Bind session to active tenant                                    |
| `GET`  | `/api/v1/sessions`                    | Bearer + tenant    | `session.revoke` or self | —           | List sessions (self by default; admin with permission)           |
| `POST` | `/api/v1/sessions/{sessionId}/revoke` | Bearer + tenant    | self or `session.revoke` | Recommended | Revoke session                                                   |

**Login response (conceptual)**

```json
{
  "data": {
    "accessToken": "<jwt-or-opaque>",
    "tokenType": "Bearer",
    "expiresIn": 900,
    "refreshToken": "<optional-or-cookie-only>",
    "user": { "id": "...", "email": "...", "displayName": "..." },
    "requiresMfa": false,
    "mfaChallengeToken": null
  }
}
```

Security notes:

- Prefer refresh token in **HttpOnly Secure** cookie for browser clients.
- Access token short-lived.
- Never return `passwordHash` or MFA secrets.
- `requiresMfa: true` continues with MFA verify endpoint.

| Method | Path                      | Auth                | Notes                             |
| ------ | ------------------------- | ------------------- | --------------------------------- |
| `POST` | `/api/v1/auth/mfa/verify` | `mfaChallengeToken` | Completes login when MFA required |

### 4.2 Tenants

| Method  | Path                         | Auth                           | Permission                     | Idempotency  | Description                                             |
| ------- | ---------------------------- | ------------------------------ | ------------------------------ | ------------ | ------------------------------------------------------- |
| `GET`   | `/api/v1/tenants`            | Bearer                         | membership / RLS (no code)     | —            | List tenants visible to caller (picker UX; unpaginated) |
| `POST`  | `/api/v1/tenants`            | Bearer (platform or bootstrap) | platform provision / bootstrap | **Required** | Create tenant + owner membership (**not open**)         |
| `GET`   | `/api/v1/tenants/{tenantId}` | Bearer + tenant + session bind | `tenant.read`                  | —            | Get bound tenant (`path` == `X-Tenant-Id`)              |
| `PATCH` | `/api/v1/tenants/{tenantId}` | Bearer + tenant                | `tenant.manage`                | Recommended  | Update name/locale/timezone (**not open**)              |
| `GET`   | `/api/v1/tenants/current`    | Bearer + tenant                | `tenant.read`                  | —            | Convenience: tenant from header (**not open**)          |

**Picker list policy:** `GET /tenants` returns `{ data }` without `page` (low membership count per user). Soft-capped at 100 rows; cursor pagination is reserved for tenant-scoped catalogues (orgs/users/memberships), not this picker.

**Implemented reads (P5–P13):** tenants, organizations, memberships, tenant-settings, users (list + get-by-id). Writes remain closed.

`POST /tenants` body:

```json
{
  "code": "demo-school",
  "name": "Demo School",
  "primaryLocale": "en",
  "timezone": "Africa/Dar_es_Salaam",
  "ownerUserId": "uuid-optional-if-caller-becomes-owner"
}
```

### 4.3 Organizations

| Method  | Path                                                | Auth            | Permission            | Idempotency  | Description        |
| ------- | --------------------------------------------------- | --------------- | --------------------- | ------------ | ------------------ |
| `GET`   | `/api/v1/organizations`                             | Bearer + tenant | `organization.read`   | —            | Cursor list        |
| `POST`  | `/api/v1/organizations`                             | Bearer + tenant | `organization.manage` | **Required** | Create school/unit |
| `GET`   | `/api/v1/organizations/{organizationId}`            | Bearer + tenant | `organization.read`   | —            | Get one            |
| `PATCH` | `/api/v1/organizations/{organizationId}`            | Bearer + tenant | `organization.manage` | Recommended  | Update             |
| `POST`  | `/api/v1/organizations/{organizationId}/deactivate` | Bearer + tenant | `organization.manage` | Recommended  | Status → inactive  |

### 4.4 Tenant settings & entitlements

| Method | Path                            | Auth            | Permission         | Idempotency | Description                       |
| ------ | ------------------------------- | --------------- | ------------------ | ----------- | --------------------------------- |
| `GET`  | `/api/v1/tenant-settings`       | Bearer + tenant | `tenant.read`      | —           | Get settings document             |
| `PUT`  | `/api/v1/tenant-settings`       | Bearer + tenant | `tenant.manage`    | Recommended | Replace validated settings object |
| `GET`  | `/api/v1/entitlements`          | Bearer + tenant | `entitlement.read` | —           | List entitlements                 |
| `GET`  | `/api/v1/subscriptions/current` | Bearer + tenant | `tenant.read`      | —           | Current subscription baseline     |

Settings body is a **versioned schema** (`schemaVersion` field required); unknown keys rejected (`VALIDATION_ERROR`).

### 4.5 Users

| Method  | Path                             | Auth            | Permission                      | Idempotency | Description                               |
| ------- | -------------------------------- | --------------- | ------------------------------- | ----------- | ----------------------------------------- |
| `GET`   | `/api/v1/users`                  | Bearer + tenant | `user.read`                     | —           | Users visible in tenant (via memberships) |
| `GET`   | `/api/v1/users/{userId}`         | Bearer + tenant | `user.read` or self             | —           | Profile in tenant context                 |
| `PATCH` | `/api/v1/users/{userId}`         | Bearer + tenant | `user.manage` or self (limited) | Recommended | Update display name etc.                  |
| `POST`  | `/api/v1/users/{userId}/disable` | Bearer + tenant | `user.manage`                   | Recommended | Disable in platform sense (careful)       |

Self-service patch limited fields: `displayName` only unless `user.manage`.

### 4.6 Tenant memberships

| Method | Path                                            | Auth            | Permission    | Idempotency  | Description                  |
| ------ | ----------------------------------------------- | --------------- | ------------- | ------------ | ---------------------------- |
| `GET`  | `/api/v1/memberships`                           | Bearer + tenant | `user.read`   | —            | List memberships             |
| `POST` | `/api/v1/memberships`                           | Bearer + tenant | `user.invite` | **Required** | Invite / add member by email |
| `GET`  | `/api/v1/memberships/{membershipId}`            | Bearer + tenant | `user.read`   | —            | Get                          |
| `POST` | `/api/v1/memberships/{membershipId}/suspend`    | Bearer + tenant | `user.manage` | Recommended  | Suspend                      |
| `POST` | `/api/v1/memberships/{membershipId}/reactivate` | Bearer + tenant | `user.manage` | Recommended  | Reactivate                   |
| `POST` | `/api/v1/memberships/{membershipId}/remove`     | Bearer + tenant | `user.manage` | Recommended  | Remove                       |

Invite body:

```json
{
  "email": "teacher@example.com",
  "displayName": "Asha Juma",
  "roleCodes": ["staff"]
}
```

Creates/finds user, membership `invited`/`active`, optional initial roles. Emits audit event.

### 4.7 Roles & permissions

| Method   | Path                                 | Auth            | Permission    | Idempotency  | Description                        |
| -------- | ------------------------------------ | --------------- | ------------- | ------------ | ---------------------------------- |
| `GET`    | `/api/v1/permissions`                | Bearer + tenant | `role.read`   | —            | Global permission catalog          |
| `GET`    | `/api/v1/roles`                      | Bearer + tenant | `role.read`   | —            | Tenant roles                       |
| `POST`   | `/api/v1/roles`                      | Bearer + tenant | `role.manage` | **Required** | Create custom role                 |
| `GET`    | `/api/v1/roles/{roleId}`             | Bearer + tenant | `role.read`   | —            | Role + permissions                 |
| `PATCH`  | `/api/v1/roles/{roleId}`             | Bearer + tenant | `role.manage` | Recommended  | Rename (not system code change)    |
| `PUT`    | `/api/v1/roles/{roleId}/permissions` | Bearer + tenant | `role.manage` | Recommended  | Replace permission set             |
| `GET`    | `/api/v1/user-roles`                 | Bearer + tenant | `role.read`   | —            | List assignments (filter `userId`) |
| `POST`   | `/api/v1/user-roles`                 | Bearer + tenant | `role.manage` | **Required** | Assign role (± organizationId)     |
| `DELETE` | `/api/v1/user-roles/{userRoleId}`    | Bearer + tenant | `role.manage` | Recommended  | Unassign                           |

System roles (`isSystem: true`) cannot be deleted; codes immutable.

### 4.8 MFA factors (high-level)

| Method | Path                                        | Auth   | Permission | Idempotency  | Description                            |
| ------ | ------------------------------------------- | ------ | ---------- | ------------ | -------------------------------------- |
| `GET`  | `/api/v1/me/mfa-factors`                    | Bearer | self       | —            | List own factors (no secrets)          |
| `POST` | `/api/v1/me/mfa-factors`                    | Bearer | self       | **Required** | Begin registration (`totp`/`webauthn`) |
| `POST` | `/api/v1/me/mfa-factors/{factorId}/confirm` | Bearer | self       | Recommended  | Confirm registration                   |
| `POST` | `/api/v1/me/mfa-factors/{factorId}/disable` | Bearer | self       | Recommended  | Disable factor                         |

Responses never include raw TOTP secrets after confirm; enrollment returns one-time setup payload only on create.

### 4.9 Relationships & delegations (minimal surface)

Included as **thin contracts** so Access Control foundations are not silent gaps. Full relationship UX deferred.

| Method | Path                              | Auth            | Permission    | Notes                               |
| ------ | --------------------------------- | --------------- | ------------- | ----------------------------------- |
| `GET`  | `/api/v1/relationships`           | Bearer + tenant | `user.read`   | Filter by subject/object            |
| `POST` | `/api/v1/relationships`           | Bearer + tenant | `user.manage` | First slice: `objectType=user` only |
| `POST` | `/api/v1/relationships/{id}/end`  | Bearer + tenant | `user.manage` | End relationship                    |
| `GET`  | `/api/v1/delegations`             | Bearer + tenant | `user.manage` | List                                |
| `POST` | `/api/v1/delegations`             | Bearer + tenant | `user.manage` | Create time-bound delegation        |
| `POST` | `/api/v1/delegations/{id}/revoke` | Bearer + tenant | `user.manage` | Revoke                              |

---

## 5. Representation examples

### User (public resource)

```json
{
  "id": "0193f0c2-7c2a-7b1e-9c1d-5f2e1a0b9c8d",
  "email": "asha@example.com",
  "displayName": "Asha Juma",
  "status": "active",
  "emailVerifiedAt": "2026-07-01T08:00:00.000Z",
  "lastLoginAt": "2026-07-14T06:00:00.000Z",
  "createdAt": "2026-06-01T10:00:00.000Z",
  "updatedAt": "2026-07-14T06:00:00.000Z"
}
```

### Tenant

```json
{
  "id": "...",
  "code": "demo-school",
  "name": "Demo School",
  "status": "active",
  "primaryLocale": "en",
  "timezone": "Africa/Dar_es_Salaam",
  "createdAt": "...",
  "updatedAt": "..."
}
```

### Organization

```json
{
  "id": "...",
  "tenantId": "...",
  "orgType": "school",
  "name": "Main Campus",
  "code": "main",
  "status": "active",
  "parentOrganizationId": null,
  "createdAt": "...",
  "updatedAt": "..."
}
```

### Membership

```json
{
  "id": "...",
  "tenantId": "...",
  "userId": "...",
  "status": "active",
  "joinedAt": "...",
  "user": { "id": "...", "email": "...", "displayName": "..." },
  "createdAt": "...",
  "updatedAt": "..."
}
```

### Role

```json
{
  "id": "...",
  "tenantId": "...",
  "code": "admin",
  "name": "Administrator",
  "isSystem": true,
  "permissions": ["tenant.manage", "user.invite"],
  "createdAt": "...",
  "updatedAt": "..."
}
```

---

## 6. Security & privacy requirements (API layer)

| Requirement      | Rule                                                                    |
| ---------------- | ----------------------------------------------------------------------- |
| Deny by default  | Missing permission → 403                                                |
| Tenant isolation | Header + membership + RLS                                               |
| Enumeration      | Cross-tenant ids → 404                                                  |
| Secrets          | Never in responses/logs                                                 |
| Audit            | Mutations on memberships, roles, tenant, sessions emit audit events     |
| Rate limits      | Login, invite, MFA verify rate-limited (exact numbers later ops freeze) |
| CORS             | Explicit allowlist; credentials rules documented at deploy time         |

---

## 7. Compatibility & evolution

| Rule               | Value                                                                 |
| ------------------ | --------------------------------------------------------------------- |
| Additive changes   | New optional fields OK without version bump                           |
| Breaking changes   | Require `/api/v2` or coordinated deprecation                          |
| Deprecation header | `Deprecation` + `Sunset` when needed                                  |
| OpenAPI            | Source of truth under `docs/engineering/api-contract-freeze/openapi/` |

---

## 8. Mapping to DBF-001

| API resource                  | Primary tables                                           |
| ----------------------------- | -------------------------------------------------------- |
| Tenant                        | `tenants`                                                |
| Organization                  | `organizations`                                          |
| Tenant settings               | `tenant_settings`                                        |
| Entitlements / subscription   | `entitlements`, `subscriptions`, `plans`                 |
| User                          | `users`                                                  |
| Membership                    | `tenant_memberships`                                     |
| Session / auth                | `sessions`                                               |
| MFA                           | `mfa_factors`                                            |
| Permission / role / user-role | `permissions`, `roles`, `role_permissions`, `user_roles` |
| Relationship / delegation     | `relationships`, `delegations`                           |
| Audit (side effect)           | `audit_events` (via platform-operations interface)       |

Module ownership follows ADR-001: Tenant module owns tenant routes; Identity owns users/auth/RBAC; no cross-module table access.

---

## 9. Explicit non-goals

- No NestJS implementation in this task
- No SQL migrations
- No student/finance endpoints
- No BFF dashboards
- No webhook APIs
- No GraphQL

---

## 10. Open questions

| ID  | Question                                          | Default                                                                                         |
| --- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Q1  | Password login vs pure OIDC                       | Dual-ready login contract; prefer OIDC when chosen                                              |
| Q2  | Refresh token transport                           | HttpOnly cookie for web; body token for native optional                                         |
| Q3  | Platform tenant-provisioning identity             | Platform operator token scheme TBD in security ADR                                              |
| Q4  | Exact rate limit numbers                          | Deferred to ops freeze                                                                          |
| Q5  | Whether `GET /users` includes invited-only emails | **Resolved (P12):** default = active membership; `?status=invited` includes invited memberships |

---

## 11. Acceptance checklist

- [x] OpenAPI baseline file for Identity & Tenant
- [x] Error contract defined
- [x] AuthZ requirements per endpoint family
- [x] Idempotency + cursor pagination standards
- [x] Alignment with DBF-001
- [x] No implementation code
- [x] Formal acceptance signatures — **solo-operator consolidation** ([SOLO-GOV-001](../governance/SOLO_OPERATOR_GOVERNANCE_NOTE.md))

### Approval block

| Role                  | Name                                                           | Date       | Signature                                               |
| --------------------- | -------------------------------------------------------------- | ---------- | ------------------------------------------------------- |
| Principal Architect   | EduCore Principal Architect / Governance Lead (acting)         | 2026-07-16 | Accepted — API Contract Freeze v1.0 (Identity & Tenant) |
| Backend Lead          | Rashid Mohammed _(acting: Governance Lead under SOLO-GOV-001)_ | 2026-07-16 | Accepted — API Contract Freeze v1.0 (Identity & Tenant) |
| Security              | Masoud Salum _(acting: Governance Lead under SOLO-GOV-001)_    | 2026-07-16 | Accepted — API Contract Freeze v1.0 (Identity & Tenant) |
| API Contract Guardian | Rashid Mohammed _(dual-hat acting under SOLO-GOV-001)_         | 2026-07-16 | Accepted — API Contract Freeze v1.0 (Identity & Tenant) |

**Status:** **API Contract Freeze v1.0 — Identity & Tenant Slice** (solo-operator).

> Honesty: OpenAPI remains the design baseline. Platform AuthN under `/api/v1/auth/*` and
> product **read** routes (tenants through users, P5–P12) are implemented with session bind +
> `RequirePermission` where required. Writes, entitlements, roles-admin, and invites remain
> **implementation-gated**. Solo-operator freeze ≠ independent peer review.

---

## 12. Revision history

| Version | Date       | Notes                                                                                           |
| ------- | ---------- | ----------------------------------------------------------------------------------------------- |
| 1.0     | 2026-07-14 | Initial Identity & Tenant API Contract Freeze proposal                                          |
| 1.1     | 2026-07-16 | Freeze v1.0 accepted under solo-operator consolidation (SOLO-GOV-001); approval block completed |
| 1.2     | 2026-07-16 | OpenAPI amend: `GET /tenants` list + get-by-id AuthZ notes (IMP-001 P5d)                        |
| 1.3     | 2026-07-20 | P10 OpenAPI P8 filters + session bind; P11/P12 users list/get honesty (AUDIT-R4 Medium)         |
| 1.4     | 2026-07-20 | Tenants picker list policy (unpaginated + soft cap); shared ILIKE helper (P13)                  |
