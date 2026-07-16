# Database Freeze v1.0 — Identity & Tenant Slice (DBF-001)

## Freeze status

| Field               | Value                                                                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Freeze ID           | `DBF-001`                                                                                                                           |
| Title               | Database Freeze — Identity & Tenant / Organization slice                                                                            |
| Version             | `1.0` (proposed for formal acceptance)                                                                                              |
| Date                | 2026-07-14                                                                                                                          |
| Authority           | Engineering design freeze under Architecture Freeze v1.0                                                                            |
| Engine              | PostgreSQL (local via DEV-001; production topology not selected)                                                                    |
| Scope               | Identity And Access + Tenant And Billing (baseline only) + shared audit surface                                                     |
| Explicitly excluded | Student, Academic, Attendance, Assessment, Finance, Payments, Communication, Documents, AI, Integrations, Analytics business tables |

**This document freezes design decisions for the first vertical slice only.**  
It does **not** authorize writing production migrations, ORM entities, or NestJS persistence code until this freeze is **formally accepted** and the companion **API Contract Freeze (ACF-001)** for the same slice is accepted for implementation. See `docs/engineering/api-contract-freeze/ACF-001-identity-tenant-slice.md`.

---

## 1. Purpose

Provide an unambiguous, reviewable database design for:

1. Multi-tenant organization structure (tenant, school/organization units, settings, entitlements baseline).
2. Identity and access (users, memberships, sessions, MFA factors, RBAC).
3. Relationship and delegation foundations required by the Access Control Bible (without Student Registry tables).
4. Tenant-scoped audit events owned by Platform Operations.
5. Row Level Security (RLS) strategy that makes cross-tenant access fail closed.

This freeze is the first required output of the “Identity and Organization” first-slice design freeze milestone in project status.

---

## 2. Inputs and authority

| Source                                   | Use                                                   |
| ---------------------------------------- | ----------------------------------------------------- |
| `EduCore/03_DEVELOPMENT_CONSTITUTION.md` | Non-negotiable rules                                  |
| `EduCore/35_PROJECT_ARCHITECTURE.md`     | Bounded contexts, PostgreSQL, UUID, RLS               |
| `EduCore/05_DATABASE_DESIGN.md`          | Core DB rules, conceptual tables, audit/RLS           |
| `EduCore/15_DOMAIN_MODEL_DDD.md`         | Ubiquitous language (Tenant, etc.)                    |
| `EduCore/16_SECURITY_STANDARDS.md`       | Tenant isolation, deny-by-default                     |
| `EduCore/32_ACCESS_CONTROL_BIBLE.md`     | Authn + membership + RBAC + relationship + ABAC + RLS |
| `EduCore/08_BACKEND_GUIDELINES.md`       | Module ownership / layering                           |
| ADR-001                                  | Modular monolith, no cross-module table access        |
| DEV-001                                  | Local Postgres available; no schema implemented yet   |

In conflict, constitution and accepted ADRs win over this freeze draft until acceptance; after acceptance, material schema changes require an ADR or a superseding freeze revision.

---

## 3. Slice scope

### In scope (frozen by DBF-001)

| Bounded context         | Responsibility in this freeze                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Tenant And Billing**  | Tenants, organizations (schools), tenant settings, plan/subscription/entitlement baseline                     |
| **Identity And Access** | Users, memberships, sessions, MFA factors, roles, permissions, user-role bindings, relationships, delegations |
| **Platform Operations** | `audit_events` only (shared operational surface used by identity/tenant workflows)                            |

### Out of scope (must not appear in first migrations of this slice)

- Students, guardians, admissions, attendance, marks, ledger, payments, notifications, files, AI tables.
- Full billing metering (`usage_events`, `metered_charges`) — deferred to a later billing freeze.
- Transactional outbox/inbox physical tables — deferred to Platform Operations foundation freeze (interfaces only today).
- Provider-specific IdP tables (OIDC client secrets, raw IdP payloads as source of truth).

### Slice outcome

After acceptance + API Contract Freeze for the same slice, Feature Sprint 1 may implement:

> Tenant onboarding → users/memberships → RBAC → sessions → audit  
> for Identity & Organization only.

---

## 4. Naming conventions (frozen)

| Concern       | Convention                                                                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Table names   | `snake_case`, plural nouns (`tenants`, `user_roles`)                                                                               |
| Column names  | `snake_case`                                                                                                                       |
| Primary keys  | `id` UUID                                                                                                                          |
| Foreign keys  | `<entity>_id`                                                                                                                      |
| Tenant column | `tenant_id` UUID on every tenant-owned table                                                                                       |
| Timestamps    | `created_at`, `updated_at`, `deleted_at` (UTC, `timestamptz`)                                                                      |
| Soft delete   | Only where retention/history requires; default is hard-delete only when legal retention allows. Prefer status enums for lifecycle. |
| Booleans      | `is_*` or clear status enums (prefer enums for multi-state)                                                                        |
| Money         | Not used in this slice                                                                                                             |
| JSON          | `jsonb` only for controlled metadata (`settings.metadata`, redacted audit diffs) — never for core relational facts                 |
| Enum types    | PostgreSQL enums or check-constrained text; values documented in freeze                                                            |
| Indexes       | `ix_<table>_<cols>`, unique `uq_<table>_<cols>`                                                                                    |
| RLS policies  | `rls_<table>_<action>`                                                                                                             |
| Migration IDs | `YYYYMMDDHHMMSS_<context>_<description>.sql`                                                                                       |

### Identifier strategy (frozen)

- All primary keys: **UUID v7** (or equivalent time-sortable UUID).
- Generate in application or DB helper consistently; do not mix random UUID v4 for new primary keys once implementation starts.
- External provider subject IDs stored as text in dedicated columns (`external_subject_id`), never as PK.

### Data types (baseline)

| Concept            | Type                                                                   |
| ------------------ | ---------------------------------------------------------------------- |
| IDs                | `uuid`                                                                 |
| Email              | `citext` (preferred) or `text` with normalized lower-case unique index |
| Short labels       | `text` with length checks                                              |
| Long text / reason | `text`                                                                 |
| Status             | `text` + `CHECK` or PG enum                                            |
| Timestamps         | `timestamptz` NOT NULL DEFAULT `now()`                                 |
| IP                 | `inet` nullable                                                        |
| User agent         | `text` nullable (truncated)                                            |
| JSON metadata      | `jsonb` NOT NULL DEFAULT `'{}'`                                        |

---

## 5. Schema layout (logical)

PostgreSQL schemas (logical namespaces; optional physical PG schemas later):

| Logical schema / prefix | Owner context       |
| ----------------------- | ------------------- |
| `iam_*` tables          | Identity And Access |
| `tenancy_*` tables      | Tenant And Billing  |
| `ops_*` tables          | Platform Operations |

**Frozen physical approach for MVP:** single database, public schema, table-name prefixes optional. Prefer **no table-name prefix** with module ownership documented (below). Cross-module **direct table access remains forbidden** (ADR-001); access only via owning module public APIs.

---

## 6. ERD (Identity & Tenant slice)

```mermaid
erDiagram
  TENANTS ||--o{ ORGANIZATIONS : contains
  TENANTS ||--|| TENANT_SETTINGS : configures
  TENANTS ||--o{ ENTITLEMENTS : grants
  PLANS ||--o{ SUBSCRIPTIONS : offers
  TENANTS ||--o{ SUBSCRIPTIONS : holds
  TENANTS ||--o{ TENANT_MEMBERSHIPS : includes
  USERS ||--o{ TENANT_MEMBERSHIPS : joins
  USERS ||--o{ SESSIONS : authenticates
  USERS ||--o{ MFA_FACTORS : secures
  TENANTS ||--o{ ROLES : defines
  PERMISSIONS ||--o{ ROLE_PERMISSIONS : maps
  ROLES ||--o{ ROLE_PERMISSIONS : maps
  TENANTS ||--o{ USER_ROLES : scopes
  USERS ||--o{ USER_ROLES : assigned
  ROLES ||--o{ USER_ROLES : grants
  ORGANIZATIONS ||--o{ USER_ROLES : optional_scope
  TENANTS ||--o{ RELATIONSHIPS : scopes
  USERS ||--o{ RELATIONSHIPS : subject
  TENANTS ||--o{ DELEGATIONS : scopes
  USERS ||--o{ DELEGATIONS : parties
  TENANTS ||--o{ AUDIT_EVENTS : records
  USERS ||--o{ AUDIT_EVENTS : actor

  TENANTS {
    uuid id PK
    text code UK
    text name
    text status
    text primary_locale
    text timezone
  }

  ORGANIZATIONS {
    uuid id PK
    uuid tenant_id FK
    text org_type
    text name
    text status
  }

  TENANT_SETTINGS {
    uuid tenant_id PK_FK
    jsonb settings
  }

  PLANS {
    uuid id PK
    text code UK
    text name
    text status
  }

  SUBSCRIPTIONS {
    uuid id PK
    uuid tenant_id FK
    uuid plan_id FK
    text status
    timestamptz starts_at
    timestamptz ends_at
  }

  ENTITLEMENTS {
    uuid id PK
    uuid tenant_id FK
    text feature_key
    text value
    text status
  }

  USERS {
    uuid id PK
    citext email UK
    text status
    text display_name
  }

  TENANT_MEMBERSHIPS {
    uuid id PK
    uuid tenant_id FK
    uuid user_id FK
    text status
  }

  SESSIONS {
    uuid id PK
    uuid user_id FK
    uuid tenant_id FK
    text status
    timestamptz expires_at
  }

  MFA_FACTORS {
    uuid id PK
    uuid user_id FK
    text factor_type
    text status
  }

  ROLES {
    uuid id PK
    uuid tenant_id FK
    text code
    text name
  }

  PERMISSIONS {
    uuid id PK
    text code UK
    text description
  }

  ROLE_PERMISSIONS {
    uuid role_id FK
    uuid permission_id FK
  }

  USER_ROLES {
    uuid id PK
    uuid tenant_id FK
    uuid user_id FK
    uuid role_id FK
    uuid organization_id FK
  }

  RELATIONSHIPS {
    uuid id PK
    uuid tenant_id FK
    uuid subject_user_id FK
    text object_type
    uuid object_id
    text relationship_type
  }

  DELEGATIONS {
    uuid id PK
    uuid tenant_id FK
    uuid delegator_user_id FK
    uuid delegatee_user_id FK
    timestamptz expires_at
  }

  AUDIT_EVENTS {
    uuid id PK
    uuid tenant_id FK
    uuid actor_user_id FK
    text action
    text resource_type
    uuid resource_id
  }
```

---

## 7. Table catalog and ownership

### 7.1 Tenant And Billing (owner module: `tenant-and-billing`)

| Table             | Purpose                                     | Tenant-owned | RLS  | Notes                                                     |
| ----------------- | ------------------------------------------- | ------------ | ---- | --------------------------------------------------------- |
| `tenants`         | Top-level customer (school or school group) | Special      | Yes* | Root entity; see RLS notes                                |
| `organizations`   | Schools / campuses / units under a tenant   | Yes          | Yes  | `org_type`: `school`, `campus`, `department` (extensible) |
| `tenant_settings` | Tenant configuration document               | Yes          | Yes  | 1:1 with tenant; controlled `jsonb`                       |
| `plans`           | Commercial plan catalog                     | No (global)  | No** | Platform-managed catalog                                  |
| `subscriptions`   | Tenant subscription to a plan               | Yes          | Yes  | Baseline billing state only                               |
| `entitlements`    | Effective feature flags/limits for tenant   | Yes          | Yes  | Source of feature enablement                              |

\* `tenants` is not child-of-tenant; RLS uses “membership visibility” and platform-operator policies.  
\*\* `plans` readable by authenticated platform/tenant admin paths via application policy; no `tenant_id`.

#### `tenants`

| Column                      | Type        | Constraints                                             | Classification |
| --------------------------- | ----------- | ------------------------------------------------------- | -------------- |
| `id`                        | uuid        | PK                                                      | Internal       |
| `code`                      | text        | UNIQUE, NOT NULL, `^[a-z0-9-]{3,64}$`                   | Internal       |
| `name`                      | text        | NOT NULL                                                | Internal       |
| `status`                    | text        | NOT NULL, CHECK (`draft`,`active`,`suspended`,`closed`) | Internal       |
| `primary_locale`            | text        | NOT NULL DEFAULT `en`                                   | Internal       |
| `timezone`                  | text        | NOT NULL DEFAULT `Africa/Dar_es_Salaam`                 | Internal       |
| `created_at` / `updated_at` | timestamptz | NOT NULL                                                | Internal       |

#### `organizations`

| Column                      | Type        | Constraints                          | Classification |
| --------------------------- | ----------- | ------------------------------------ | -------------- |
| `id`                        | uuid        | PK                                   | Internal       |
| `tenant_id`                 | uuid        | NOT NULL FK → tenants                | Internal       |
| `org_type`                  | text        | NOT NULL                             | Internal       |
| `name`                      | text        | NOT NULL                             | Internal       |
| `code`                      | text        | NULL, unique per tenant              | Internal       |
| `status`                    | text        | NOT NULL CHECK (`active`,`inactive`) | Internal       |
| `parent_organization_id`    | uuid        | NULL FK → organizations              | Internal       |
| `created_at` / `updated_at` | timestamptz | NOT NULL                             | Internal       |

Unique: `(tenant_id, code)` where code not null. Index: `(tenant_id, status)`.

#### `tenant_settings`

| Column               | Type        | Constraints           | Classification                            |
| -------------------- | ----------- | --------------------- | ----------------------------------------- |
| `tenant_id`          | uuid        | PK FK → tenants       | Internal                                  |
| `settings`           | jsonb       | NOT NULL DEFAULT `{}` | Sensitive (may include operational prefs) |
| `updated_at`         | timestamptz | NOT NULL              | Internal                                  |
| `updated_by_user_id` | uuid        | NULL FK → users       | Internal                                  |

Settings keys must be versioned in application schema validation (not free-form app dumps).

#### `plans` (global catalog)

| Column                      | Type        | Constraints     | Classification  |
| --------------------------- | ----------- | --------------- | --------------- |
| `id`                        | uuid        | PK              | Public/Internal |
| `code`                      | text        | UNIQUE NOT NULL | Public/Internal |
| `name`                      | text        | NOT NULL        | Public/Internal |
| `status`                    | text        | NOT NULL        | Internal        |
| `created_at` / `updated_at` | timestamptz | NOT NULL        | Internal        |

#### `subscriptions`

| Column                      | Type        | Constraints                                                | Classification     |
| --------------------------- | ----------- | ---------------------------------------------------------- | ------------------ |
| `id`                        | uuid        | PK                                                         | Financial/Internal |
| `tenant_id`                 | uuid        | NOT NULL FK                                                | Internal           |
| `plan_id`                   | uuid        | NOT NULL FK → plans                                        | Internal           |
| `status`                    | text        | NOT NULL CHECK (`trialing`,`active`,`past_due`,`canceled`) | Financial          |
| `starts_at`                 | timestamptz | NOT NULL                                                   | Internal           |
| `ends_at`                   | timestamptz | NULL                                                       | Internal           |
| `created_at` / `updated_at` | timestamptz | NOT NULL                                                   | Internal           |

#### `entitlements`

| Column                      | Type        | Constraints                              | Classification |
| --------------------------- | ----------- | ---------------------------------------- | -------------- |
| `id`                        | uuid        | PK                                       | Internal       |
| `tenant_id`                 | uuid        | NOT NULL FK                              | Internal       |
| `feature_key`               | text        | NOT NULL                                 | Internal       |
| `value`                     | text        | NOT NULL                                 | Internal       |
| `status`                    | text        | NOT NULL CHECK (`enabled`,`disabled`)    | Internal       |
| `source`                    | text        | NOT NULL CHECK (`plan`,`manual`,`trial`) | Internal       |
| `created_at` / `updated_at` | timestamptz | NOT NULL                                 | Internal       |

Unique: `(tenant_id, feature_key)`.

---

### 7.2 Identity And Access (owner module: `identity-and-access`)

| Table                | Purpose                                 | Tenant-owned        | RLS   |
| -------------------- | --------------------------------------- | ------------------- | ----- |
| `users`              | Global person identity                  | Special             | Yes*  |
| `tenant_memberships` | User ↔ tenant membership                | Yes                 | Yes   |
| `sessions`           | Authenticated sessions                  | Yes (active tenant) | Yes   |
| `mfa_factors`        | Registered MFA methods                  | User-scoped         | Yes** |
| `permissions`        | Global permission catalog               | No                  | No**  |
| `roles`              | Tenant-defined (or seeded) roles        | Yes                 | Yes   |
| `role_permissions`   | Role → permission map                   | Via role            | Yes   |
| `user_roles`         | Role assignment in tenant (± org scope) | Yes                 | Yes   |
| `relationships`      | Relationship-based access foundation    | Yes                 | Yes   |
| `delegations`        | Time-bound permission delegation        | Yes                 | Yes   |

\* Users are visible through membership of `app.current_tenant` or self/session rules; platform operators use explicit break-glass.  
\*\* MFA factors are restricted to owning user (and controlled platform recovery paths). Permission catalog is global read for authz engine.

#### `users`

| Column                      | Type        | Constraints                                             | Classification  |
| --------------------------- | ----------- | ------------------------------------------------------- | --------------- |
| `id`                        | uuid        | PK                                                      | Internal        |
| `email`                     | citext      | UNIQUE NOT NULL                                         | Sensitive       |
| `email_verified_at`         | timestamptz | NULL                                                    | Internal        |
| `display_name`              | text        | NOT NULL                                                | Internal        |
| `status`                    | text        | NOT NULL CHECK (`invited`,`active`,`disabled`,`locked`) | Internal        |
| `password_hash`             | text        | NULL                                                    | Credential-like |
| `external_subject_id`       | text        | NULL UNIQUE                                             | Internal        |
| `last_login_at`             | timestamptz | NULL                                                    | Internal        |
| `created_at` / `updated_at` | timestamptz | NOT NULL                                                | Internal        |

Notes:

- Password hash optional if pure OIDC; column reserved, never log.
- Identity provider choice remains flexible (architecture still open); design supports either local password or external subject.

#### `tenant_memberships`

| Column                      | Type        | Constraints                                               | Classification |
| --------------------------- | ----------- | --------------------------------------------------------- | -------------- |
| `id`                        | uuid        | PK                                                        | Internal       |
| `tenant_id`                 | uuid        | NOT NULL FK                                               | Internal       |
| `user_id`                   | uuid        | NOT NULL FK                                               | Internal       |
| `status`                    | text        | NOT NULL CHECK (`invited`,`active`,`suspended`,`removed`) | Internal       |
| `joined_at`                 | timestamptz | NULL                                                      | Internal       |
| `created_at` / `updated_at` | timestamptz | NOT NULL                                                  | Internal       |

Unique: `(tenant_id, user_id)`.

#### `sessions`

| Column               | Type        | Constraints                                   | Classification               |
| -------------------- | ----------- | --------------------------------------------- | ---------------------------- |
| `id`                 | uuid        | PK                                            | Credential-like (session id) |
| `user_id`            | uuid        | NOT NULL FK                                   | Internal                     |
| `tenant_id`          | uuid        | NOT NULL FK                                   | Internal                     |
| `session_token_hash` | text        | NOT NULL UNIQUE                               | Credential-like              |
| `status`             | text        | NOT NULL CHECK (`active`,`revoked`,`expired`) | Internal                     |
| `ip`                 | inet        | NULL                                          | Sensitive                    |
| `user_agent`         | text        | NULL                                          | Internal                     |
| `created_at`         | timestamptz | NOT NULL                                      | Internal                     |
| `expires_at`         | timestamptz | NOT NULL                                      | Internal                     |
| `revoked_at`         | timestamptz | NULL                                          | Internal                     |
| `last_seen_at`       | timestamptz | NULL                                          | Internal                     |

Indexes: `(user_id, status)`, `(tenant_id, status)`, `(expires_at)`.

#### `mfa_factors`

| Column                      | Type        | Constraints                                    | Classification  |
| --------------------------- | ----------- | ---------------------------------------------- | --------------- |
| `id`                        | uuid        | PK                                             | Internal        |
| `user_id`                   | uuid        | NOT NULL FK                                    | Internal        |
| `factor_type`               | text        | NOT NULL CHECK (`totp`,`webauthn`,`sms_otp`)   | Internal        |
| `status`                    | text        | NOT NULL CHECK (`pending`,`active`,`disabled`) | Internal        |
| `secret_encrypted`          | text        | NULL                                           | Credential-like |
| `created_at` / `updated_at` | timestamptz | NOT NULL                                       | Internal        |

#### `permissions` (global)

| Column        | Type        | Constraints                                         | Classification |
| ------------- | ----------- | --------------------------------------------------- | -------------- |
| `id`          | uuid        | PK                                                  | Internal       |
| `code`        | text        | UNIQUE NOT NULL (`tenant.manage`, `user.invite`, …) | Internal       |
| `description` | text        | NOT NULL                                            | Internal       |
| `created_at`  | timestamptz | NOT NULL                                            | Internal       |

Permission codes are product-owned vocabulary; first-slice seed set is limited to identity/tenant administration.

#### `roles`

| Column                      | Type        | Constraints            | Classification |
| --------------------------- | ----------- | ---------------------- | -------------- |
| `id`                        | uuid        | PK                     | Internal       |
| `tenant_id`                 | uuid        | NOT NULL FK            | Internal       |
| `code`                      | text        | NOT NULL               | Internal       |
| `name`                      | text        | NOT NULL               | Internal       |
| `is_system`                 | boolean     | NOT NULL DEFAULT false | Internal       |
| `created_at` / `updated_at` | timestamptz | NOT NULL               | Internal       |

Unique: `(tenant_id, code)`. System roles seeded per tenant on provisioning (`owner`, `admin`, `staff` baseline — product may refine).

#### `role_permissions`

| Column          | Type        | Constraints         | Classification |
| --------------- | ----------- | ------------------- | -------------- |
| `role_id`       | uuid        | PK FK → roles       | Internal       |
| `permission_id` | uuid        | PK FK → permissions | Internal       |
| `created_at`    | timestamptz | NOT NULL            | Internal       |

#### `user_roles`

| Column               | Type        | Constraints             | Classification |
| -------------------- | ----------- | ----------------------- | -------------- |
| `id`                 | uuid        | PK                      | Internal       |
| `tenant_id`          | uuid        | NOT NULL FK             | Internal       |
| `user_id`            | uuid        | NOT NULL FK             | Internal       |
| `role_id`            | uuid        | NOT NULL FK             | Internal       |
| `organization_id`    | uuid        | NULL FK → organizations | Internal       |
| `created_at`         | timestamptz | NOT NULL                | Internal       |
| `created_by_user_id` | uuid        | NULL FK → users         | Internal       |

Unique: `(tenant_id, user_id, role_id, COALESCE(organization_id, zero-uuid))` (implementation may use unique index with nulls-not-distinct on PG15+).

#### `relationships` (foundation for relationship-aware authz)

| Column                      | Type        | Constraints                           | Classification |
| --------------------------- | ----------- | ------------------------------------- | -------------- |
| `id`                        | uuid        | PK                                    | Internal       |
| `tenant_id`                 | uuid        | NOT NULL FK                           | Internal       |
| `subject_user_id`           | uuid        | NOT NULL FK → users                   | Internal       |
| `object_type`               | text        | NOT NULL (`user`,`student`,`class`,…) | Internal       |
| `object_id`                 | uuid        | NOT NULL                              | Internal       |
| `relationship_type`         | text        | NOT NULL (`parent_of`,`teacher_of`,…) | Internal       |
| `status`                    | text        | NOT NULL CHECK (`active`,`ended`)     | Internal       |
| `starts_at` / `ends_at`     | timestamptz | ends nullable                         | Internal       |
| `created_at` / `updated_at` | timestamptz | NOT NULL                              | Internal       |

**Important:** First slice may only create `object_type='user'` rows. Future Student Registry freeze will authorize `student` objects without changing PK design. No FK to students table is created in DBF-001.

#### `delegations`

| Column                      | Type        | Constraints                                   | Classification |
| --------------------------- | ----------- | --------------------------------------------- | -------------- |
| `id`                        | uuid        | PK                                            | Internal       |
| `tenant_id`                 | uuid        | NOT NULL FK                                   | Internal       |
| `delegator_user_id`         | uuid        | NOT NULL FK                                   | Internal       |
| `delegatee_user_id`         | uuid        | NOT NULL FK                                   | Internal       |
| `scope_json`                | jsonb       | NOT NULL                                      | Sensitive      |
| `reason`                    | text        | NOT NULL                                      | Audit-critical |
| `status`                    | text        | NOT NULL CHECK (`active`,`revoked`,`expired`) | Internal       |
| `starts_at` / `expires_at`  | timestamptz | NOT NULL                                      | Internal       |
| `created_at` / `updated_at` | timestamptz | NOT NULL                                      | Internal       |

---

### 7.3 Platform Operations (owner module: `platform-operations`)

| Table          | Purpose                                     | Tenant-owned | RLS |
| -------------- | ------------------------------------------- | ------------ | --- |
| `audit_events` | Immutable audit trail for sensitive actions | Yes          | Yes |

#### `audit_events`

| Column           | Type        | Constraints                          | Classification |
| ---------------- | ----------- | ------------------------------------ | -------------- |
| `id`             | uuid        | PK                                   | Audit-critical |
| `tenant_id`      | uuid        | NOT NULL FK                          | Internal       |
| `actor_user_id`  | uuid        | NULL FK → users                      | Internal       |
| `actor_type`     | text        | NOT NULL (`user`,`system`,`support`) | Internal       |
| `action`         | text        | NOT NULL                             | Audit-critical |
| `resource_type`  | text        | NOT NULL                             | Internal       |
| `resource_id`    | uuid        | NULL                                 | Internal       |
| `correlation_id` | text        | NULL                                 | Internal       |
| `ip`             | inet        | NULL                                 | Sensitive      |
| `user_agent`     | text        | NULL                                 | Internal       |
| `reason`         | text        | NULL                                 | Audit-critical |
| `before_summary` | jsonb       | NOT NULL DEFAULT `{}`                | Redacted       |
| `after_summary`  | jsonb       | NOT NULL DEFAULT `{}`                | Redacted       |
| `created_at`     | timestamptz | NOT NULL                             | Internal       |

Rules:

- Append-only (no UPDATE/DELETE for app roles).
- No passwords, tokens, OTPs, or raw secrets in summaries.
- Partition candidate by `created_at` (range) when volume justifies — plan now, implement when needed.

Indexes: `(tenant_id, created_at DESC)`, `(tenant_id, resource_type, resource_id)`, `(actor_user_id, created_at DESC)`.

---

## 8. Table ownership matrix (ADR-001)

| Table                                                                                                                                              | Owning bounded context | Nest module           | Who may write                                                                    | Who may read (via API)                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | --------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `tenants`, `organizations`, `tenant_settings`, `subscriptions`, `entitlements`                                                                     | Tenant And Billing     | `tenant-and-billing`  | Tenant module only                                                               | Identity (membership checks) via public interfaces              |
| `plans`                                                                                                                                            | Tenant And Billing     | `tenant-and-billing`  | Platform ops / billing admin paths                                               | Catalog reads                                                   |
| `users`, `tenant_memberships`, `sessions`, `mfa_factors`, `roles`, `permissions`, `role_permissions`, `user_roles`, `relationships`, `delegations` | Identity And Access    | `identity-and-access` | Identity module only                                                             | Tenant module may request membership status via public API only |
| `audit_events`                                                                                                                                     | Platform Operations    | `platform-operations` | Any module via **audit publisher interface** (not direct SQL from other modules) | Compliance/admin APIs                                           |

**Forbidden:** Identity module querying Tenant tables by raw SQL/repository; Tenant module mutating sessions; any module inserting into another module’s tables.

---

## 9. RLS strategy (frozen)

### 9.1 Session variables (transaction-scoped)

Set by application middleware **inside each transaction**:

| Setting                    | Meaning                                                  |
| -------------------------- | -------------------------------------------------------- |
| `app.current_tenant`       | UUID of active tenant (required for tenant-owned access) |
| `app.current_user`         | UUID of authenticated user (optional for system jobs)    |
| `app.is_platform_operator` | `true`/`false` break-glass                               |
| `app.support_session_id`   | Optional UUID when support access approved               |
| `app.rls_mode`             | `tenant` (default) \| `platform` \| `bootstrap`          |

Requirements (from kit):

- Tenant context is **transaction-scoped**, not long-lived connection state.
- Fail closed if `app.current_tenant` missing for tenant-owned operations.
- Platform operator bypass must be explicit, time-bound, and audited.

### 9.2 Policy patterns

**Pattern A — standard tenant-owned table**

```sql
-- Pseudocode policy predicate
tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
```

Applied to: `organizations`, `tenant_settings`, `subscriptions`, `entitlements`, `tenant_memberships`, `roles`, `role_permissions` (via join/role ownership), `user_roles`, `relationships`, `delegations`, `sessions`, `audit_events`.

**Pattern B — `tenants` visibility**

- SELECT allowed if:
  - `id = app.current_tenant`, or
  - user has active membership (policy using `EXISTS` on `tenant_memberships`), or
  - `app.is_platform_operator = true` with `app.rls_mode = platform`.
- INSERT of new tenants: bootstrap/platform provisioning role only (`app.rls_mode = bootstrap` or platform).

**Pattern C — `users`**

- SELECT if:
  - `id = app.current_user`, or
  - user has active membership in `app.current_tenant`, or
  - platform operator mode.
- UPDATE self limited fields vs admin paths enforced in application policies as well.

**Pattern D — `mfa_factors`**

- Only owning `user_id = app.current_user` (plus controlled recovery operator path).

**Pattern E — `permissions` / `plans`**

- No tenant RLS; access controlled by application authorization (authenticated services). Still no public anonymous DB roles.

### 9.3 Database roles (implementation guidance)

| DB role            | Use                                                       |
| ------------------ | --------------------------------------------------------- |
| `educore_app`      | Runtime app role; RLS forced (`FORCE ROW LEVEL SECURITY`) |
| `educore_migrator` | Migrations only; bypass RLS carefully, never used by app  |
| `educore_readonly` | Optional support analytics (still RLS or views)           |

Application connections must use `educore_app` with `SET ROLE` / no superuser.

### 9.4 Tenant isolation test matrix (required before implementation sign-off)

| #   | Scenario                                                 | Expected                                  |
| --- | -------------------------------------------------------- | ----------------------------------------- |
| T1  | Read organizations with tenant A context                 | Only A rows                               |
| T2  | Read organizations with tenant B context after A inserts | No A rows                                 |
| T3  | Missing `app.current_tenant`                             | Deny / empty / error (fail closed)        |
| T4  | User membership of A cannot SELECT users only in B       | Deny                                      |
| T5  | Session row of tenant A invisible under tenant B         | Deny                                      |
| T6  | Platform operator mode can SELECT with audit             | Allow + audit event required at app layer |
| T7  | Direct SQL without policy bypass role                    | RLS enforced                              |
| T8  | Audit event insert from app role cannot UPDATE/DELETE    | Deny                                      |

---

## 10. Indexes and integrity (baseline)

Beyond PKs/uniques listed above:

| Table                | Index                                                     | Rationale               |
| -------------------- | --------------------------------------------------------- | ----------------------- |
| `organizations`      | `(tenant_id, name)`                                       | Admin listing           |
| `tenant_memberships` | `(user_id, status)`                                       | “My tenants”            |
| `sessions`           | `(session_token_hash)` unique                             | Auth lookup             |
| `user_roles`         | `(tenant_id, user_id)`                                    | Authz resolution        |
| `relationships`      | `(tenant_id, subject_user_id, relationship_type, status)` | Authz resolution        |
| `relationships`      | `(tenant_id, object_type, object_id, status)`             | Reverse lookup          |
| `delegations`        | `(tenant_id, delegatee_user_id, status, expires_at)`      | Active delegation check |
| `audit_events`       | `(tenant_id, created_at DESC)`                            | Timeline queries        |

Foreign keys must match ownership; **no FK from Identity tables into future Student tables** in this freeze.

---

## 11. Data classification & privacy

| Classification  | Examples in this slice                                    | Controls                                            |
| --------------- | --------------------------------------------------------- | --------------------------------------------------- |
| Credential-like | `password_hash`, `session_token_hash`, `secret_encrypted` | Never log; encrypt MFA secrets at rest; hash tokens |
| Sensitive       | email, IP                                                 | Minimize; redact in audit summaries                 |
| Audit-critical  | audit action/reason                                       | Append-only; retention policy later                 |
| Internal        | most structural fields                                    | Tenant RLS + app authz                              |

Retention specifics remain governed by privacy/retention kit docs; freeze requires that soft-delete/status models do not prevent legal erasure workflows.

---

## 12. Migration strategy (first implementation after acceptance)

### 12.1 Tooling

- PostgreSQL migrations only (exact runner tool still flexible: Flyway/Liquibase/node-pg-migrate/custom — **tool choice not frozen**).
- Migrations owned by Platform Operations standards; SQL reviewed with Security for RLS.
- Local DB via DEV-001 Docker Postgres.

### 12.2 Ordered migration groups (logical)

1. **Extensions** — `pgcrypto`/`citext` as needed.
2. **Global catalogs** — `permissions`, `plans`.
3. **Tenants root** — `tenants`.
4. **Users root** — `users`.
5. **Tenant children** — organizations, settings, subscriptions, entitlements, memberships.
6. **IAM** — sessions, mfa, roles, role_permissions, user_roles, relationships, delegations.
7. **Audit** — `audit_events`.
8. **RLS enable + policies** — enable RLS + force for app role; create policies.
9. **Grants** — privileges to `educore_app` / migrator roles.
10. **Seeds** — global permissions; optional demo tenant only in non-prod.

### 12.3 Rollback plan

| Phase                    | Rollback approach                                                                |
| ------------------------ | -------------------------------------------------------------------------------- |
| Before production data   | `DOWN` migrations drop policies/tables in reverse order                          |
| After limited pilot data | Restore from snapshot/PITR; prefer forward-fix migrations over destructive downs |
| RLS policy defect        | Deploy corrected policy migration; keep fail-closed default                      |
| Bad seed                 | Delete by known seed markers; never silent cascade of tenant data                |

Rules:

- Every migration PR includes forward SQL + documented rollback/restore notes.
- No destructive change to `audit_events` without security approval.
- Expand-contract for renames once production data exists.

### 12.4 Seed strategy (non-prod)

- Global permission catalog for identity/tenant admin actions.
- Optional fixture tenant `demo` with owner user — **test only**, isolated.
- No production secrets in seeds.

---

## 13. Seed permission codes (first-slice catalog — frozen names)

Minimum permission codes for Identity & Tenant administration:

- `tenant.read`
- `tenant.manage`
- `organization.read`
- `organization.manage`
- `user.invite`
- `user.read`
- `user.manage`
- `role.read`
- `role.manage`
- `session.revoke`
- `audit.read`
- `entitlement.read`
- `entitlement.manage`

Additional domain permissions arrive with later freezes.

---

## 14. Explicit non-goals (reaffirmed)

- No Student Registry / Academic / Attendance / Assessment / Finance / Payments tables.
- No ORM entities or NestJS repositories connecting to DB in this task.
- No API OpenAPI freeze (separate ACF-001).
- No Design System freeze.
- No identity provider vendor lock-in (OIDC vs custom still open).
- No production hosting topology.

---

## 15. Open questions (do not block freeze acceptance if defaults accepted)

| ID  | Question                          | Default if unresolved                            | Owner            |
| --- | --------------------------------- | ------------------------------------------------ | ---------------- |
| Q1  | UUID v7 generation in app vs DB   | App-generated UUID v7                            | Backend          |
| Q2  | Exact IdP product                 | Design supports OIDC subject + optional password | Security/Product |
| Q3  | Multi-org role assignment UX      | `user_roles.organization_id` nullable            | Product          |
| Q4  | Physical PG schemas vs public     | Public schema MVP                                | DBA              |
| Q5  | Partition `audit_events` at day-1 | Plan only; implement when volume requires        | DBA              |

---

## 16. Acceptance checklist

- [x] ERD for Identity & Tenant slice documented
- [x] Table list complete for slice
- [x] Ownership per table defined
- [x] RLS strategy + test matrix defined
- [x] Naming conventions and data types defined
- [x] Migration order + rollback approach defined
- [x] Non-goals and exclusions explicit
- [x] **Formal acceptance** (Architect + Security + Backend Lead signatures) — **solo-operator consolidation** ([SOLO-GOV-001](../governance/SOLO_OPERATOR_GOVERNANCE_NOTE.md))

### Approval block

| Role                | Name                                                           | Date       | Signature                                           |
| ------------------- | -------------------------------------------------------------- | ---------- | --------------------------------------------------- |
| Database Architect  | PM Master _(acting: Governance Lead under SOLO-GOV-001)_       | 2026-07-16 | Accepted — Database Freeze v1.0 (Identity & Tenant) |
| Principal Architect | EduCore Principal Architect / Governance Lead (acting)         | 2026-07-16 | Accepted — Database Freeze v1.0 (Identity & Tenant) |
| Security            | Masoud Salum _(acting: Governance Lead under SOLO-GOV-001)_    | 2026-07-16 | Accepted — Database Freeze v1.0 (Identity & Tenant) |
| Backend Lead        | Rashid Mohammed _(acting: Governance Lead under SOLO-GOV-001)_ | 2026-07-16 | Accepted — Database Freeze v1.0 (Identity & Tenant) |

**Status:** **Database Freeze v1.0 — Identity & Tenant Slice** (solo-operator). Changes only via revision `DBF-001.x` or superseding freeze.

> Honesty: signatures consolidate theoretical role seats into one acting authority per Project Owner direction. Not independent multi-person review.

---

## 17. Downstream impacts

| Workstream                                | Impact                                                                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| API Contract Freeze (recommended ACF-001) | Must expose resources matching these aggregates                                                                                             |
| NestJS modules                            | `identity-and-access`, `tenant-and-billing`, `platform-operations` implement repositories against these tables only after freeze acceptance |
| PLAT-005 boundaries                       | Repositories stay inside owning modules                                                                                                     |
| DEV-001 Docker Postgres                   | Target engine for migration dry-runs                                                                                                        |
| Full Database Freeze                      | Later expands ERD to remaining bounded contexts                                                                                             |

---

## 18. Revision history

| Version | Date       | Notes                                                                                           |
| ------- | ---------- | ----------------------------------------------------------------------------------------------- |
| 1.0     | 2026-07-14 | Initial Identity & Tenant slice freeze proposal (DBF-001)                                       |
| 1.1     | 2026-07-16 | Freeze v1.0 accepted under solo-operator consolidation (SOLO-GOV-001); approval block completed |
