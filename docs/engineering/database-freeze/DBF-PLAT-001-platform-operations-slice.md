# Database Freeze — Platform Operations (DBF-PLAT-001)

| Field     | Value                                             |
| --------- | ------------------------------------------------- |
| Freeze ID | `DBF-PLAT-001`                                    |
| Version   | `1.0`                                             |
| Date      | 2026-08-15                                        |
| Companion | ACF-PLAT-001 · DSF-007                            |
| Authority | Owner GO in session 2026-08-15 (SOLO-GOV-002/003) |

**Honesty:** Freezes the minimal platform-layer schema for Phase 1a. Builds on what already exists: `tenants` (lifecycle statuses draft/active/suspended/closed — DBF-001), `plans` global catalog (DBF-001), and the `app.is_platform_operator()` RLS function (already in the RLS foundation, currently always set `false` by app transactions). No support-session or metering tables yet.

## Existing objects reused (no change)

| Object                                              | Use                                                                     |
| --------------------------------------------------- | ----------------------------------------------------------------------- |
| `tenants`                                           | Lifecycle source of truth; suspend/reinstate mutate `status` via helper |
| `plans`                                             | Plan catalog; writes stay migrator/ops-only                             |
| `app.is_platform_operator()`                        | RLS escape for platform transactions (finally exercised)                |
| `users`, `tenant_memberships`, role grant machinery | Owner bootstrap on tenant registration                                  |

## New tables

### `platform_operators` (global; not tenant-owned)

| Column                      | Type                 | Notes                                                                       |
| --------------------------- | -------------------- | --------------------------------------------------------------------------- |
| `user_id`                   | uuid PK, FK → users  | one row per operator                                                        |
| `role`                      | text                 | `CHECK (role IN ('super_admin','support'))` — `support` reserved, unused v1 |
| `status`                    | text                 | `CHECK (status IN ('active','revoked'))`                                    |
| `granted_by`                | uuid NULL FK → users | NULL for migrator seed                                                      |
| `created_at` / `updated_at` | timestamptz          |                                                                             |

Seeding: Owner's user via ops script/migrator. Runtime app: SELECT only (grants/revokes are ops-path v1). No RLS (global catalog pattern, like `plans`), but **read path is platform-guard-only** at the app layer.

### `tenant_plan_assignments`

| Column                     | Type               | Notes                                                                                                    |
| -------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------- |
| `id`                       | uuid PK            |                                                                                                          |
| `tenant_id`                | uuid FK → tenants  |                                                                                                          |
| `plan_id`                  | uuid FK → plans    |                                                                                                          |
| `status`                   | text               | `CHECK (status IN ('active','ended'))`                                                                   |
| `assigned_by`              | uuid FK → users    | platform operator                                                                                        |
| `reason`                   | text               | required (5–500)                                                                                         |
| `assigned_at` / `ended_at` | timestamptz / NULL | history preserved; **one active per tenant** (partial unique index on `tenant_id WHERE status='active'`) |

### `tenant_entitlements`

| Column                      | Type              | Notes                                                                                             |
| --------------------------- | ----------------- | ------------------------------------------------------------------------------------------------- |
| `id`                        | uuid PK           |                                                                                                   |
| `tenant_id`                 | uuid FK → tenants |                                                                                                   |
| `code`                      | text              | allowlist v1: `sms`, `ai`, `payments.momo`, `student_portal`; `CHECK` format `^[a-z][a-z0-9_.]*$` |
| `enabled`                   | boolean           |                                                                                                   |
| `limit_value`               | integer NULL      | `CHECK (limit_value >= 0)`                                                                        |
| `updated_by`                | uuid FK → users   |                                                                                                   |
| `created_at` / `updated_at` | timestamptz       | `UNIQUE (tenant_id, code)`                                                                        |

RLS: tenant members may **SELECT own tenant rows** (feeds existing `entitlement.read`); INSERT/UPDATE platform-mode only. No DELETE for runtime role.

### `audit_events` (lands the deferred audit persistence)

| Column                          | Type        | Notes                                                       |
| ------------------------------- | ----------- | ----------------------------------------------------------- |
| `id`                            | uuid PK     |                                                             |
| `occurred_at`                   | timestamptz | indexed (cursor key with id)                                |
| `action`                        | text        | e.g. `platform.tenant.suspend`                              |
| `outcome`                       | text        | `CHECK (outcome IN ('success','failure','denied'))`         |
| `correlation_id`                | text        |                                                             |
| `actor_user_id`                 | uuid NULL   |                                                             |
| `tenant_id`                     | uuid NULL   | NULL = platform-scope event                                 |
| `resource_type` / `resource_id` | text NULL   |                                                             |
| `metadata`                      | jsonb NULL  | **redacted before append** (existing `redactAuditMetadata`) |

Append-only: runtime app gets INSERT + SELECT; **no UPDATE/DELETE** grants. RLS: platform mode reads all; tenant mode reads only `tenant_id = current tenant` (serves future tenant-side `audit.read`). Writers use the existing `AuditPublisher` port — the Noop publisher is replaced by a DB-backed one under this freeze.

## Transaction pattern

New `platformTransaction` wrapper (mirror of tenant wrapper): `app.rls_mode='platform'`, `app.is_platform_operator='true'`, `app.current_user=<operator>`; **used only by the Platform Operations module**. Tenant transactions keep setting `false` (unchanged).

## Not frozen / later

Support-session tables (`ACF-PLAT-002`) · metering aggregates · plan catalog CRUD · billing invoices · portal-preference table (Phase 1b/2 routing DBF).

## Rollback

All new tables are additive; down-migrations drop them. No changes to existing tables' columns.

## Amendments

| Ver | Date       | Notes                                    |
| --- | ---------- | ---------------------------------------- |
| 1.0 | 2026-08-15 | Initial platform-layer schema (Phase 1a) |
