# Implementation Plan: Read Increments — Organizations + Memberships + Tenant Settings

## Overview

Open three **read-only** product HTTP surfaces under ADR-012 / conditional freeze, aligned with ACF-001:

| #   | Endpoint                      | Permission          | Owner module          |
| --- | ----------------------------- | ------------------- | --------------------- |
| 1   | `GET /api/v1/organizations`   | `organization.read` | `tenant-and-billing`  |
| 2   | `GET /api/v1/memberships`     | `user.read`         | `identity-and-access` |
| 3   | `GET /api/v1/tenant-settings` | `tenant.read`       | `tenant-and-billing`  |

Order is fixed: Organizations → Memberships → Tenant Settings. No writes. No users/roles admin.

## Discovery summary (Phase A)

### Already shipped (do not re-implement)

- `GET /api/v1/tenants` — membership list (`RequireAuthGuard` only)
- `GET /api/v1/tenants/{id}` / `current` — `RequirePermission('tenant.read')` + path/header bind

### Pattern anchors

| Concern                           | Existing artifact                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| Privileged tenant read controller | `tenants.controller.ts` (`RequirePermission`, auth/tenant context keys)                     |
| Service                           | `tenants.service.ts`                                                                        |
| User-scoped RLS tx                | `withUserRlsTransaction` (list tenants — no current_tenant)                                 |
| Tenant-scoped RLS tx              | `withTenantTransaction` (roles, permissions — **use for all three new GETs**)               |
| Pagination                        | `common/pagination/cursor-pagination.ts` (`parsePaginationQuery`, `buildPaginatedResponse`) |
| Permission catalog                | seeded: `organization.read`, `user.read`, `tenant.read`                                     |
| System roles                      | staff/admin/owner include the three read codes                                              |

### Auth stack (named explicitly per route)

All three endpoints share the **privileged tenant-read** stack (same class as `GET /tenants/current`):

1. **Authenticated** — Bearer via request platform → `AUTH_CONTEXT_REQUEST_KEY`
2. **Active tenant context** — `X-Tenant-Id` → `TENANT_CONTEXT_REQUEST_KEY`
3. **Session ↔ header bind** — inside `RequirePermission` (`assertSessionTenantMatchesHeader`)
4. **Permission code** — `RequirePermission('<code>')` → `PolicyEvaluator` + membership-aware source
5. **Data scope** — `withTenantTransaction({ userId, tenantId })` so RLS GUC `app.current_tenant` / `app.current_user` are set; never trust client tenant id alone

Controller still re-checks auth/tenant context presence and maps to `AppError.unauthorized()` / `AppError.tenantContextRequired()` (mirror `TenantsController`).

### Schema status (ground truth)

| Table                | Migrations present?                       | Notes                                                                  |
| -------------------- | ----------------------------------------- | ---------------------------------------------------------------------- |
| `tenant_memberships` | **Yes** (`20260714180000` + RLS `190000`) | Ready for Inc 2                                                        |
| `organizations`      | **No**                                    | Blocker for Inc 1 — must add **read-path migration** from DBF-001 §7.1 |
| `tenant_settings`    | **No**                                    | Blocker for Inc 3 — must add **read-path migration** from DBF-001 §7.1 |

Permission seeds for `organization.read` / `user.read` / `tenant.read` already exist (`20260714130000_seed_catalogs`).

### ASSUMPTIONS

1. **Memberships list scope (ACF 4.6):** list memberships **in the bound tenant** for callers with `user.read` — not “my memberships across tenants” (that remains `/auth/me` summaries).
2. **Organizations list scope (ACF 4.3):** list orgs for the bound tenant only; optional `status` filter; cursor page envelope.
3. **Tenant settings missing row:** return **404** `NOT_FOUND` (document + amend OpenAPI if needed). OpenAPI today omits 404; empty fake document is avoided.
4. **`schema_version` column:** DBF lists only `settings` jsonb; OpenAPI requires top-level `schemaVersion`. Add `schema_version integer NOT NULL DEFAULT 1` on `tenant_settings` as the smallest ACF-aligned additive column.
5. **App role grants:** `educore_app` gets **SELECT only** on new tables (no INSERT/UPDATE/DELETE) — matches roles/memberships read posture under freeze.
6. **Cursor pagination:** reuse existing helpers; opaque cursor = last row `id` (uuid), order stable by `name ASC, id ASC` (orgs) / `created_at ASC, id ASC` (memberships).
7. **No user join expansion required for v1 memberships list** — return core Membership fields; optional nested `user` deferred if it risks PII over-fetch; may include minimal user when join is cheap and RLS allows (prefer core fields first).

## Architecture decisions

1. **Mirror tenants vertical slice** — controller → service → repository; unit tests with mocked repo/service.
2. **Module ownership per DBF:** orgs + settings in `tenant-and-billing`; memberships in `identity-and-access`.
3. **Schema before HTTP for missing tables** — migrations are part of the increment that needs them (not a speculative multi-table mega-migration).
4. **Read-only freeze** — document “No POST/PATCH/DELETE” on each controller; do not register write routes even if OpenAPI lists them.
5. **Fail-closed** — invalid UUID / no pool / DB errors: empty list for list endpoints; 404 for settings get (no existence leak across tenants).

## Threat lens (STRIDE — product read surfaces)

| Threat                 | Control                                                                  |
| ---------------------- | ------------------------------------------------------------------------ |
| Spoofing               | RequireAuth + session token validation (existing platform)               |
| Tampering              | Parameterized SQL; no client-driven SQL fragments                        |
| Information disclosure | RLS Pattern A; permission gate; 404 not cross-tenant row leaks           |
| Elevation              | `organization.read` / `user.read` / `tenant.read` required; session bind |

## Task list

### Increment 1 — Organizations list (M)

**Schema (S, required prerequisite)**

- Migration `organizations` per DBF-001: columns, unique `(tenant_id, code)` where code not null, index `(tenant_id, status)`, FORCE RLS, Pattern A SELECT policies, SELECT-only app grants.
- Optionally add `user_roles.organization_id` FK → `organizations(id)` (safe additive; do only if low risk — prefer skip if it expands blast radius).

**HTTP vertical slice**

- Repository: `listOrganizations(userId, tenantId, { limit, cursor, status? })` via `withTenantTransaction`
- Service: validation + envelope `{ data, page }`
- Controller: `GET api/v1/organizations` + `RequirePermission('organization.read')` + query parse
- Tests: happy / 401 / no tenant / (permission via guard unit if existing pattern) / empty list / service isolation of tenant id
- Task record: `docs/engineering/task-records/IMP-001-P6-organizations-list-read.md`
- Gate: `npm run check` → commit

### Checkpoint after Inc 1

- [ ] Green `npm run check`
- [ ] No write routes
- [ ] Atomic commit

### Increment 2 — Memberships list (M)

- Repository on identity module: list memberships for bound tenant (+ optional status filter, cursor page)
- Service + controller `GET api/v1/memberships` + `RequirePermission('user.read')`
- Decision locked: **tenant-scoped membership list** (ACF), not cross-tenant “mine”
- Tests + task record `IMP-001-P6b-memberships-list-read.md`
- Gate + commit

### Checkpoint after Inc 2

- [ ] Green check; freeze intact

### Increment 3 — Tenant settings read (S–M)

- Migration `tenant_settings` (PK `tenant_id`, `settings`, `schema_version`, `updated_at`, optional `updated_by_user_id`) + RLS Pattern A + SELECT-only app
- Repository get-by-tenant; service maps to envelope; missing → 404
- Controller `GET api/v1/tenant-settings` + `RequirePermission('tenant.read')`
- Do **not** implement PUT
- Tests + task record `IMP-001-P6c-tenant-settings-read.md`
- Gate + commit

### Final

- Re-run `npm run check`
- Freeze review (no new Post/Patch/Put/Delete on these resources)
- Final report (prompt §6)

## Files likely touched (by increment)

### Inc 1 (~6–8 files)

- `apps/api/db/migrations/*_organizations.up.sql` / `.down.sql`
- `apps/api/src/modules/tenant-and-billing/repositories/organizations.repository.ts` (+ test)
- `apps/api/src/modules/tenant-and-billing/application/organizations.service.ts` (+ test)
- `apps/api/src/modules/tenant-and-billing/controllers/organizations.controller.ts` (+ test)
- `apps/api/src/modules/tenant-and-billing/tenant-and-billing.module.ts`
- `docs/engineering/task-records/IMP-001-P6-organizations-list-read.md`

### Inc 2 (~6–7 files)

- `.../identity-and-access/repositories/memberships.repository.ts` (+ test)
- `.../identity-and-access/application/memberships.service.ts` (+ test)
- `.../identity-and-access/controllers/memberships.controller.ts` (+ test)
- `.../identity-and-access/identity-and-access.module.ts`
- `docs/engineering/task-records/IMP-001-P6b-memberships-list-read.md`

### Inc 3 (~6–8 files)

- `apps/api/db/migrations/*_tenant_settings.up.sql` / `.down.sql`
- `.../tenant-and-billing/repositories/tenant-settings.repository.ts` (+ test)
- `.../tenant-and-billing/application/tenant-settings.service.ts` (+ test)
- `.../tenant-and-billing/controllers/tenant-settings.controller.ts` (+ test)
- `tenant-and-billing.module.ts`
- `docs/engineering/task-records/IMP-001-P6c-tenant-settings-read.md`
- Optional OpenAPI 404 amendment for settings

## Risks and mitigations

| Risk                                               | Impact | Mitigation                                                                       |
| -------------------------------------------------- | ------ | -------------------------------------------------------------------------------- |
| Missing `organizations` / `tenant_settings` tables | High   | Explicit DBF-aligned migrations in Inc 1 / 3                                     |
| Cursor style invents third pagination shape        | Med    | Reuse `cursor-pagination` helpers only                                           |
| Membership “mine” vs “tenant list” confusion       | Med    | Document ACF decision; no `/auth/me` duplication                                 |
| Schema drift DBF vs OpenAPI (`schemaVersion`)      | Med    | Additive `schema_version` column; document in task record                        |
| File count exceeds ~5–8                            | Med    | Split schema commit only if check requires; prefer one commit per full increment |

## Open questions

1. ~~Memberships scope~~ — **Resolved:** bound-tenant list under `user.read` (ACF 4.6).
2. **Settings missing document:** planned **404**; if product prefers auto-empty defaults, flip in Inc 3 before merge.
3. **Nested `user` on membership list items:** deferred unless tests need it; core Membership fields first.
4. **Live isolation tests** for orgs T1/T2: optional if existing isolation suite pattern extends easily; unit tests mandatory.

## Out of scope

- All writes (POST/PATCH/PUT/DELETE)
- `GET /users`, roles admin, entitlements, subscriptions
- Frontend
- New npm dependencies
- Speculative tables (subscriptions, entitlements) not required by these three GETs

## Verification commands

```bash
npm run check
# targeted (optional, after implementation):
npx vitest run apps/api/src/modules/tenant-and-billing
npx vitest run apps/api/src/modules/identity-and-access
```
