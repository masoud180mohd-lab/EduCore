# Todo: Read Increments — Orgs + Memberships + Settings

## Phase A/B — Discover & plan

- [x] Read ACF 4.3 / 4.4 / 4.6 + OpenAPI paths
- [x] Inspect tenants controller/service/repository/tests
- [x] Locate schema: memberships yes; organizations/settings **missing**
- [x] Confirm permission seeds + RequirePermission stack
- [x] Write `tasks/plan-read-increments-orgs-memberships-settings.md`
- [x] Write this todo file

## Increment 1 — `GET /api/v1/organizations` (`organization.read`)

- [x] Migration: `organizations` table + RLS Pattern A + SELECT-only app grants
- [x] Repository + unit tests
- [x] Service + unit tests
- [x] Controller + unit tests
- [x] Wire module
- [x] Task record `IMP-001-P6-organizations-list-read.md`
- [x] `npm run check`
- [x] Atomic commit `feat: ...`

**Acceptance:**

- [x] Happy path returns `{ data, page }` for bound tenant
- [x] Unauthenticated → 401 class
- [x] Missing tenant context → TENANT_CONTEXT_REQUIRED
- [x] Missing permission → 403 (guard)
- [x] Empty list stable `{ data: [], page: { nextCursor: null, limit } }`
- [x] No write routes
- [x] Cross-tenant: queries only under `withTenantTransaction` (tenant GUC)

**Verify:** `npm run check`

**Files:** migration pair; `organizations.{repository,service,controller}.ts` + tests; module; task record

**Deps:** none | **Size:** M

---

## Increment 2 — `GET /api/v1/memberships` (`user.read`)

- [x] Repository (tenant-scoped list) + tests
- [x] Service + tests
- [x] Controller + tests
- [x] Wire `identity-and-access` module
- [x] Task record `IMP-001-P6b-memberships-list-read.md`
- [x] `npm run check`
- [x] Atomic commit

**Acceptance:**

- [x] Lists memberships for **bound tenant only** (ACF decision)
- [x] AuthZ stack: auth + tenant + bind + `user.read`
- [x] Empty / status filter / cursor envelope
- [x] No writes

**Verify:** `npm run check`

**Deps:** Inc 1 green | **Size:** M

---

## Increment 3 — `GET /api/v1/tenant-settings` (`tenant.read`)

- [x] Migration: `tenant_settings` + `schema_version` + RLS + SELECT-only
- [x] Repository / service / controller + tests
- [x] Missing row → **404** (documented)
- [x] Task record `IMP-001-P6c-tenant-settings-read.md`
- [x] `npm run check`
- [x] Atomic commit

**Acceptance:**

- [x] Returns versioned settings document for bound tenant
- [x] AuthZ: auth + tenant + bind + `tenant.read`
- [x] No PUT route
- [x] No secret leakage beyond public settings shape

**Verify:** `npm run check`

**Deps:** Inc 2 green | **Size:** S–M

---

## Phase D — Final

- [x] Full `npm run check`
- [x] Confirm no `@Post`/`@Patch`/`@Put`/`@Delete` on new resource controllers
- [x] Final report (prompt §6)

## Backlog (do not build)

- [ ] Item #4: `GET /users`, roles admin, other admin-ish reads
