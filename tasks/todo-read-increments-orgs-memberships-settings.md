# Todo: Read Increments — Orgs + Memberships + Settings

## Phase A/B — Discover & plan

- [x] Read ACF 4.3 / 4.4 / 4.6 + OpenAPI paths
- [x] Inspect tenants controller/service/repository/tests
- [x] Locate schema: memberships yes; organizations/settings **missing**
- [x] Confirm permission seeds + RequirePermission stack
- [x] Write `tasks/plan-read-increments-orgs-memberships-settings.md`
- [x] Write this todo file

## Increment 1 — `GET /api/v1/organizations` (`organization.read`)

- [ ] Migration: `organizations` table + RLS Pattern A + SELECT-only app grants
- [ ] Repository + unit tests
- [ ] Service + unit tests
- [ ] Controller + unit tests
- [ ] Wire module
- [ ] Task record `IMP-001-P6-organizations-list-read.md`
- [ ] `npm run check`
- [ ] Atomic commit `feat: ...`

**Acceptance:**

- [ ] Happy path returns `{ data, page }` for bound tenant
- [ ] Unauthenticated → 401 class
- [ ] Missing tenant context → TENANT_CONTEXT_REQUIRED
- [ ] Missing permission → 403 (guard)
- [ ] Empty list stable `{ data: [], page: { nextCursor: null, limit } }`
- [ ] No write routes
- [ ] Cross-tenant: queries only under `withTenantTransaction` (tenant GUC)

**Verify:** `npm run check`

**Files:** migration pair; `organizations.{repository,service,controller}.ts` + tests; module; task record

**Deps:** none | **Size:** M

---

## Increment 2 — `GET /api/v1/memberships` (`user.read`)

- [ ] Repository (tenant-scoped list) + tests
- [ ] Service + tests
- [ ] Controller + tests
- [ ] Wire `identity-and-access` module
- [ ] Task record `IMP-001-P6b-memberships-list-read.md`
- [ ] `npm run check`
- [ ] Atomic commit

**Acceptance:**

- [ ] Lists memberships for **bound tenant only** (ACF decision)
- [ ] AuthZ stack: auth + tenant + bind + `user.read`
- [ ] Empty / status filter / cursor envelope
- [ ] No writes

**Verify:** `npm run check`

**Deps:** Inc 1 green | **Size:** M

---

## Increment 3 — `GET /api/v1/tenant-settings` (`tenant.read`)

- [ ] Migration: `tenant_settings` + `schema_version` + RLS + SELECT-only
- [ ] Repository / service / controller + tests
- [ ] Missing row → **404** (documented)
- [ ] Task record `IMP-001-P6c-tenant-settings-read.md`
- [ ] `npm run check`
- [ ] Atomic commit

**Acceptance:**

- [ ] Returns versioned settings document for bound tenant
- [ ] AuthZ: auth + tenant + bind + `tenant.read`
- [ ] No PUT route
- [ ] No secret leakage beyond public settings shape

**Verify:** `npm run check`

**Deps:** Inc 2 green | **Size:** S–M

---

## Phase D — Final

- [ ] Full `npm run check`
- [ ] Confirm no `@Post`/`@Patch`/`@Put`/`@Delete` on new resource controllers
- [ ] Final report (prompt §6)

## Backlog (do not build)

- [ ] Item #4: `GET /users`, roles admin, other admin-ish reads
