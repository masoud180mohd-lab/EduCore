# Identity & Tenant Read Increments — Comprehensive Review

**Audit ID:** AUDIT-R4  
**Date:** 2026-07-20  
**Reviewer role:** Principal Software Architect + Senior QA (adversarial; review-only)  
**Scope:** P5–P9 product read increments + P4/P4b/P4c/P4d foundations  
**Governance posture:** Solo-operator freeze (SOLO-GOV-001) — **not** re-accepting freezes or opening writes in this review.

---

## 1. Executive summary

The Identity & Tenant **read slice** is structurally sound: nine GET product routes are registered with **no accidental write handlers**, tenant-scoped routes consistently use `RequirePermission` (session↔header bind + membership-aware permission source), repositories use parameterized SQL with RLS transactions, detail endpoints map cross-tenant/missing ids to **404**, and fail-closed DB handling is consistent (warn + empty/null). Unit coverage is broad (326 tests pass in this session’s `npm run check`), but **assurance is still mock-heavy** — guards are tested in isolation, controllers are tested **without** guards, and **live RLS evidence does not cover** organizations, tenant-settings, or HTTP-level AuthZ on product routes.

**Top 3 strengths**

1. **Layered deny-by-default AuthZ** — `RequirePermission` → `assertSessionTenantMatchesHeader` → `MembershipAwarePermissionSource` → RLS GUC transactions (`withTenantTransaction` / `withUserRlsTransaction`).
2. **Consistent product-read architecture** — controller → service (validation/envelope) → repository (RLS SQL); writes explicitly absent across tenant-and-billing and identity product controllers.
3. **Pagination/filter hardening (P8)** — shared `parsePaginationQuery`, ILIKE escape, keyset cursors with stable `(name,id)` / `(created_at,id)` / `(display_name,id)` ordering on orgs/memberships/users.

**Top 3 risks / weaknesses**

1. **Live isolation + HTTP AuthZ gap** — no end-to-end proof that product routes reject spoofed `X-Tenant-Id`, missing permissions, or cross-tenant ids against a real DB.
2. **OpenAPI / ACF drift on P8 filters and AuthZ metadata** — implemented `search`, `orgType`, `userId` query params are missing from OpenAPI list operations; `session_tenant_bind` documented only on `getTenant`.
3. **Semantic + contract incompleteness** — `GET /users/{userId}` not implemented; `GET /users` excludes invited-only roster rows (ACF Q5 default says include via status filter); governance honesty blocks still describe only tenant reads.

**Overall risk:** **Medium** — no evidence of an exploitable tenancy leak in static review, but **false confidence is possible** without live multi-tenant HTTP matrix and OpenAPI sync. Solo-operator freeze adds **residual governance risk** (no independent peer challenge).

**Recommendation on next step:** **Fix High assurance gaps + OpenAPI amend (IMP-sized hardening sprint), then manual multi-tenant QA** — **hold all write routes** until live isolation matrix and HTTP AuthZ tests exist.

---

## 2. Inventory table

| Endpoint                        | Module              | Permission                         | Task record | OpenAPI op              | Impl status     | Tests                                         |
| ------------------------------- | ------------------- | ---------------------------------- | ----------- | ----------------------- | --------------- | --------------------------------------------- |
| `GET /api/v1/tenants`           | tenant-and-billing  | _(none — auth + RLS membership)_   | P5          | `listAccessibleTenants` | **Implemented** | Controller, service, repo unit; P5 structural |
| `GET /api/v1/tenants/current`   | tenant-and-billing  | `tenant.read`                      | P5c-current | `getCurrentTenant`      | **Implemented** | Controller unit (guard not exercised)         |
| `GET /api/v1/tenants/:id`       | tenant-and-billing  | `tenant.read` + path=`X-Tenant-Id` | P5b, P5c    | `getTenant`             | **Implemented** | Controller unit; path mismatch test           |
| `GET /api/v1/organizations`     | tenant-and-billing  | `organization.read`                | P6, P8      | `listOrganizations`     | **Implemented** | Controller/service/repo unit                  |
| `GET /api/v1/organizations/:id` | tenant-and-billing  | `organization.read`                | P7          | `getOrganization`       | **Implemented** | Controller/service/repo unit                  |
| `GET /api/v1/tenant-settings`   | tenant-and-billing  | `tenant.read`                      | P6c         | `getTenantSettings`     | **Implemented** | Controller/service/repo unit                  |
| `GET /api/v1/memberships`       | identity-and-access | `user.read`                        | P6b, P8     | `listMemberships`       | **Implemented** | Controller/service/repo unit                  |
| `GET /api/v1/memberships/:id`   | identity-and-access | `user.read`                        | P7b         | `getMembership`         | **Implemented** | Controller/service/repo unit                  |
| `GET /api/v1/users`             | identity-and-access | `user.read`                        | P9          | `listUsers`             | **Implemented** | Controller/service/repo unit                  |

**Claimed in ACF/OpenAPI but not in code**

| Endpoint                             | OpenAPI op            | Notes                                                  |
| ------------------------------------ | --------------------- | ------------------------------------------------------ |
| `GET /api/v1/users/{userId}`         | `getUser`             | Explicitly deferred in P9; controller comment confirms |
| `GET /api/v1/entitlements`           | _(entitlements list)_ | Not in scope P5–P9                                     |
| `GET /api/v1/subscriptions/current`  | _(subscription)_      | Not in scope                                           |
| All POST/PATCH/DELETE product routes | various               | **Correctly absent** from controllers                  |

**Supporting (out of table scope but reviewed):** `GET /api/v1/auth/me` (P4c membership-gated roles/permissions), P4b session bind, P4d fail-closed warn logging.

---

## 3. Per-endpoint scorecard

| Endpoint                 | Contract                        | AuthZ            | Isolation                      | Pagination/Filters | Errors                 | Tests           | S   |
| ------------------------ | ------------------------------- | ---------------- | ------------------------------ | ------------------ | ---------------------- | --------------- | --- |
| `GET /tenants`           | Partial (no page; OK by design) | Good (auth-only) | RLS Pattern B                  | N/A (full list)    | Empty on fail-closed   | Unit            | B+  |
| `GET /tenants/current`   | Aligned                         | Good             | RLS + bind                     | N/A                | 404 not found          | Unit (no guard) | B   |
| `GET /tenants/:id`       | Aligned                         | Good + path bind | RLS + 404                      | N/A                | 403 path mismatch      | Unit            | A-  |
| `GET /organizations`     | Partial (OpenAPI filters)       | Good             | RLS A + tenant SQL             | P8 full            | Empty page fail-closed | Unit            | B+  |
| `GET /organizations/:id` | Aligned                         | Good             | RLS + 404                      | N/A                | 404 generic            | Unit            | B+  |
| `GET /tenant-settings`   | Aligned                         | Good             | RLS A                          | N/A                | 404 if missing         | Unit            | B   |
| `GET /memberships`       | Partial (OpenAPI userId)        | Good             | RLS A (all statuses in tenant) | P8 full            | Empty page             | Unit            | B+  |
| `GET /memberships/:id`   | Aligned                         | Good             | RLS + 404                      | N/A                | 404 generic            | Unit            | B+  |
| `GET /users`             | Partial (Q5 semantics)          | Good             | RLS C + active EXISTS          | P8 full            | Empty page             | Unit            | B   |

**Legend (S):** A = production-ready evidence; B = acceptable MVP with known gaps; C = block further increments.

---

## 4. Consistency review

### AuthZ

| Pattern                  | Tenants list | Tenants current/id | Orgs / settings                                   | Memberships / users   |
| ------------------------ | ------------ | ------------------ | ------------------------------------------------- | --------------------- |
| `RequireAuthGuard` only  | Yes          | —                  | —                                                 | —                     |
| `RequirePermission(...)` | —            | `tenant.read`      | org: `organization.read`; settings: `tenant.read` | `user.read`           |
| Session↔header bind      | No (picker)  | Yes (via guard)    | Yes                                               | Yes                   |
| Path tenant match        | N/A          | N/A                | N/A                                               | Only on `tenants/:id` |

**Same family, different behavior (intentional but easy to misuse):**

- **Tenants list** is membership/RLS-only (no permission code) — correct for post-login picker.
- **All other tenant-scoped lists** require explicit permission codes.
- Only **`GET /tenants/:id`** enforces path=`X-Tenant-Id`; org/membership detail rely on bound tenant + RLS (path id can differ syntactically but still 404 if wrong tenant) — acceptable, but clients may expect uniform 403 semantics.

`RequireActiveMembershipGuard` exists but product routes rely on `MembershipAwarePermissionSource` inside `RequirePermission` instead — **equivalent for permission denial**, but **not identical error codes** (`TENANT_MEMBERSHIP_REQUIRED` vs empty permissions → `FORBIDDEN`).

### Errors

| Condition                             | Typical response              | Consistent?                             |
| ------------------------------------- | ----------------------------- | --------------------------------------- |
| No Bearer                             | 401                           | Yes                                     |
| No `X-Tenant-Id` on privileged routes | 400 `TENANT_CONTEXT_REQUIRED` | Yes                                     |
| Session/header tenant mismatch        | 403 `SESSION_TENANT_MISMATCH` | Yes (guard)                             |
| Missing permission                    | 403 `FORBIDDEN`               | Yes                                     |
| Cross-tenant / missing detail id      | 404 generic message           | Yes (good — no leak)                    |
| Invalid `limit`                       | 400 validation                | Yes (service)                           |
| Invalid `cursor` (non-uuid)           | **200 empty page**            | **Inconsistent** with strict validation |
| DB pool missing                       | List → empty; detail → 404    | Intentional fail-closed split           |

### Response shapes

- **Paginated lists:** `{ data, page: { nextCursor, limit } }` — orgs, memberships, users ✓
- **Tenants list:** `{ data: Tenant[] }` only — matches `TenantListEnvelope` (no `page`) ✓
- **Details / settings:** `{ data: T }` ✓
- Field naming: camelCase in JSON (`primaryLocale`, `orgType`, `displayName`) — aligned with OpenAPI schemas ✓

### Pagination

- Defaults: **25**; max **100** — consistent via `parsePaginationQuery`.
- Cursor strategies differ by entity (documented in repos) — acceptable if OpenAPI describes opacity; clients must not assume one cursor format.
- **Invalid cursor:** repositories return empty page (orgs/memberships/users) instead of 400 — same family, silent behavior.

### Filtering

- Status enums validated in services — consistent.
- ILIKE escape duplicated in `organizations.service.ts` and `users.service.ts` — same logic, not shared helper (minor debt).
- **Users list** hard-filters `tenant_memberships.status = 'active'`; **memberships list** can return `invited`/`suspended`/`removed` — **different roster views by design**, but surprises operators expecting ACF Q5 on `/users`.

### Naming / modules

- **tenant-and-billing:** tenants, organizations, tenant-settings — justified (tenant-owned catalog/config).
- **identity-and-access:** memberships, users — justified (principal/roster).
- Module boundary check passes (227 modules, 715 deps) — no PLAT-005 violations observed.

---

## 5. Security & isolation review

### Threats considered

- `X-Tenant-Id` spoofing vs session-bound tenant (P4b)
- Cross-tenant id enumeration on detail routes
- Permission bypass without active membership
- PII exposure via users list (`email`, `displayName`)
- SQL injection / ILIKE wildcard injection
- RLS bypass via GUC spoofing on `educore_app`
- Accidental write surface registration
- Fail-closed masking production DB outages as empty data

### Findings

### [High] No live HTTP AuthZ / isolation matrix for product read routes

- **Evidence:** Controller tests invoke methods directly (`tenants.controller.test.ts`, etc.) — guards not wired. `app.bootstrap.smoke.test.ts` hits `/health` only. Live suite (`tests/isolation/tenant-rls.live.test.ts`) covers **tenants/users** at SQL level, not organizations, tenant_settings, or HTTP stack.
- **Impact:** Regressions in guard wiring, middleware order, or RLS on new tables could ship despite green unit tests.
- **Recommendation:** Add `tests/isolation/product-reads.live.test.ts` (or HTTP e2e): two tenants, two users, assert 403 on header spoof, 404 on cross-tenant ids, empty/deny without permission. Gate with `RUN_LIVE_DB_TESTS=1`.
- **Effort:** M

### [High] OpenAPI missing P8 query parameters on list operations

- **Evidence:** `listOrganizations` OpenAPI has `status` only — code accepts `orgType`, `search` (`organizations.controller.ts`, P8 task record). `listUsers` lacks `search`; `listMemberships` lacks `userId`. Grep of OpenAPI shows no `name: search` / `name: orgType` under those paths.
- **Impact:** Contract clients and codegen will omit filters; guardian drift violates ACF-as-baseline honesty.
- **Recommendation:** Amend `acf-001-identity-tenant.openapi.yaml` list params + ACF §4.3–4.6 tables; add contract harness assertions (extend `openapi-harness.test.ts`).
- **Effort:** S

### [Medium] Invalid cursor returns silent empty page (not validation error)

- **Evidence:** `organizations.repository.ts`, `memberships.repository.ts`, `users.repository.ts` — `if (query.cursor !== undefined && !isUuid(query.cursor)) return { rows: [], nextCursor: null }`. Service validates `limit` via `parsePaginationQuery` but not cursor shape at service layer.
- **Impact:** Clients cannot distinguish bad cursor from empty tenant; pagination bugs hard to debug; differs from strict ACF validation posture.
- **Recommendation:** Validate cursor as UUID in `parsePaginationQuery` or shared list-query parser → 400 `VALIDATION_ERROR`.
- **Effort:** S

### [Medium] Users list cursor keyset subquery lacks tenant scope (defense-in-depth)

- **Evidence:** `users.repository.ts` cursor clause selects from `users u2` by id only; orgs/memberships subqueries include `tenant_id = $1`. Main query still has active-membership EXISTS + RLS.
- **Impact:** Under RLS failure or future query change, cursor pagination could behave incorrectly; inconsistent with sibling repos.
- **Recommendation:** Align cursor subquery with org pattern: join/filter by bound tenant + membership.
- **Effort:** S

### [Medium] `GET /users` excludes invited-only members (ACF Q5 tension)

- **Evidence:** `users.repository.ts` `EXISTS … m.status = 'active'`; P9 task documents residual. ACF-001 Q5 default: include invited with status filter.
- **Impact:** Admin UX gap — invited teachers visible via `/memberships?status=invited` but not `/users?status=invited`; product confusion, not a direct leak.
- **Recommendation:** Either amend ACF Q5 decision to “active membership only for users list” or relax EXISTS to align with status filter (with RLS review).
- **Effort:** M

### [Medium] OpenAPI `x-authz` understates session bind on privileged routes

- **Evidence:** Only `getTenant` lists `session_tenant_bind` in OpenAPI; `getCurrentTenant`, orgs, users, memberships, settings list `active_membership` but code uses `RequirePermission` → bind.
- **Impact:** Integrators may omit bind from mental model; contract guardian false sense.
- **Recommendation:** Add `session_tenant_bind` to all tenant-header GET x-authz stacks (read ops only); note `listAccessibleTenants` exception.
- **Effort:** S

### [Medium] Governance / honesty docs stale vs shipped surface

- **Evidence:** `FREEZE_ACCEPTANCE_IDENTITY_TENANT.md` residual: “RequirePermission not yet on business routes”; ACF-001 honesty (§11) mentions only tenant reads, not P6–P9.
- **Impact:** Operators misread readiness; audit trail inaccurate (solo-operator already weak).
- **Recommendation:** Update freeze residual + ACF rev 1.3 honesty paragraph listing implemented read ops — **documentation only, not re-signing freeze**.
- **Effort:** S

### [Low] Tenants list unbounded (no pagination)

- **Evidence:** `accessible-tenants.repository.ts` `ORDER BY code` without LIMIT; typical users have few tenants.
- **Impact:** Theoretical scale issue if platform grows to many memberships per user.
- **Recommendation:** Defer until needed; document in ACF if picker list stays unpaginated.
- **Effort:** S

### [Low] Duplicated ILIKE escape helpers

- **Evidence:** `escapeIlikePattern` in `organizations.service.ts` and `users.service.ts`.
- **Recommendation:** Move to `common/pagination` or `common/validation` when next touched.
- **Effort:** S

### [FYI] Writes remain closed

- **Evidence:** No `@Post/@Patch/@Delete` in product controllers under tenant-and-billing / identity product surfaces (auth routes excepted).
- **Impact:** None for this audit.

### [FYI] Solo-operator governance residual

- Freeze signatures consolidated under SOLO-GOV-001 — **not independent multi-person review**. This audit does **not** constitute freeze acceptance or production sign-off.

---

## 6. Performance & scalability

| Area                               | MVP OK?                                        | At 10k+ rows                                                                  |
| ---------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------- |
| Org list `(tenant_id, name)` index | Yes — migration `ix_organizations_tenant_name` | Keyset pagination OK                                                          |
| Membership list `(created_at, id)` | Yes                                            | Index on `(tenant_id, created_at)` may help — verify EXPLAIN under load       |
| Users list ILIKE `%search%`        | OK for small tenants                           | Leading wildcard → seq scan; require min search length or trigram index later |
| Tenants list full scan             | OK (low cardinality per user)                  | Monitor if multi-tenant operators emerge                                      |
| Pool per request                   | Short transactions — good                      | Watch connection churn under concurrent list traffic                          |

**Finding (Medium — perf):** Users/memberships search uses `%term%` ILIKE — acceptable for MVP; plan index strategy before large rosters.

---

## 7. OpenAPI / ACF-001 alignment matrix

| Contract item                        | Status               | Notes                                                 |
| ------------------------------------ | -------------------- | ----------------------------------------------------- |
| `GET /tenants` list                  | **Aligned**          | `TenantListEnvelope` without page — matches impl      |
| `GET /tenants/current`               | **Partial**          | Implemented; x-authz missing `session_tenant_bind`    |
| `GET /tenants/{tenantId}`            | **Aligned**          | P5d amend + path bind in code                         |
| `GET /organizations` + page envelope | **Aligned** shape    | **Partial** params: missing `orgType`, `search`       |
| `GET /organizations/{id}`            | **Aligned**          |                                                       |
| `GET /tenant-settings`               | **Aligned**          |                                                       |
| `GET /memberships` + page            | **Aligned** shape    | **Partial** params: missing `userId`                  |
| `GET /memberships/{id}`              | **Aligned**          |                                                       |
| `GET /users` + page                  | **Aligned** shape    | **Partial** params: missing `search`; semantics vs Q5 |
| `GET /users/{userId}`                | **Missing**          | OpenAPI defines; code absent (P9 non-goal)            |
| P8 filters in OpenAPI                | **Partial**          | Implemented in code, not in spec                      |
| Session bind in x-authz              | **Partial**          | Documented on getTenant only                          |
| Write routes                         | **Aligned (closed)** | Spec exists; code correctly omits                     |
| Error envelope                       | **Aligned**          | AppError mapping consistent                           |
| User fields (no password)            | **Aligned**          | Repo SELECT explicit columns                          |

---

## 8. Test evidence map

| Risk                         | Covered by                                                         | Gap?                                            |
| ---------------------------- | ------------------------------------------------------------------ | ----------------------------------------------- |
| Session↔header bind          | `session-tenant-bind.test.ts`, `require-permission.guard.test.ts`  | **Yes** — not on real HTTP product routes       |
| Permission denial            | `require-permission.guard.test.ts`, `pg-permission-source.test.ts` | **Yes** — no route-level integration            |
| Cross-tenant detail 404      | Service/repo unit tests                                            | **Yes** — no live two-tenant HTTP               |
| RLS tenants/users            | `tenant-rls.live.test.ts` (skip without DB)                        | Partial                                         |
| RLS organizations            | Migration + repo unit mocks                                        | **Yes** — no live                               |
| RLS tenant_settings          | Migration + repo unit mocks                                        | **Yes** — no live                               |
| Pagination/filter validation | Service/repo units                                                 | Invalid cursor gap                              |
| ILIKE injection              | Repo tests check ESCAPE                                            | OK at unit level                                |
| Fail-closed warn             | P4d + repo tests (`failed closed`)                                 | OK                                              |
| No write routes              | Controller structure / grep                                        | OK                                              |
| Module boundaries            | `npm run boundaries:check`                                         | OK                                              |
| OpenAPI critical paths       | `openapi-harness.test.ts`                                          | P8 params not asserted                          |
| P6–P9 structural tooling     | —                                                                  | **Yes** — unlike P5 (`p5-tenants-list.test.ts`) |

### Commands run in this review session

```text
npm run check
  → format:check PASS
  → lint PASS
  → typecheck PASS
  → vitest: 75 files, 326 passed, 1 skipped
  → env:check PASS
  → boundaries:check PASS (227 modules)
```

**Not run:** `RUN_LIVE_DB_TESTS=1` live isolation suite (requires local Postgres; recorded prior evidence in AUDIT-R2 / operator todo only).

---

## 9. Gaps & missing features (solid slice, still read-only)

**Product-read completeness (prioritized)**

1. `GET /users/{userId}` — in ACF/OpenAPI; deferred in P9
2. `GET /entitlements`, `GET /subscriptions/current` — ACF §4.4; not started
3. Roles/permissions read (`/roles`, `/permissions`, `/user-roles`) — ACF §4.7; not started
4. Users list invited-only visibility — ACF Q5 vs P9 active-only rule

**Quality / assurance gaps (prioritized)**

1. Live multi-tenant HTTP isolation matrix for all nine GET routes
2. OpenAPI sync for P8 filters + session bind metadata
3. Structural tooling tests for P6–P9 (mirror P5 pattern)
4. Cursor validation policy (400 vs empty page)

---

## 10. Improvement backlog (prioritized)

### High (do before any write increment)

| Action                                                            | Why                         | Effort | Suggested IMP                   |
| ----------------------------------------------------------------- | --------------------------- | ------ | ------------------------------- |
| Live HTTP + DB isolation matrix for product reads                 | Close highest assurance gap | M      | IMP-001-P10-live-read-isolation |
| OpenAPI amend: P8 query params + x-authz session bind             | Contract guardian duty      | S      | IMP-001-P10b-openapi-read-sync  |
| HTTP integration tests: AuthZ denial on 2–3 representative routes | Prove guard wiring          | M      | IMP-001-P10 (same)              |

### Medium (next hardening sprint)

| Action                                   | Why                       | Effort | Suggested IMP                |
| ---------------------------------------- | ------------------------- | ------ | ---------------------------- |
| Validate cursor UUID → 400               | Predictable client errors | S      | IMP-001-P11-list-validation  |
| Users repo cursor subquery tenant scope  | Defense-in-depth parity   | S      | IMP-001-P11                  |
| Resolve `/users` vs Q5 invited semantics | Product/clarity           | M      | IMP-001-P12-users-visibility |
| Implement `GET /users/{id}`              | ACF completeness          | M      | IMP-001-P12                  |
| Add P6–P9 structural tooling tests       | Regression net            | S      | IMP-001-P10b                 |
| Update FREEZE/ACF honesty (no re-sign)   | Governance accuracy       | S      | docs-only                    |

### Low (polish)

| Action                                   | Why           | Effort |
| ---------------------------------------- | ------------- | ------ |
| Extract shared ILIKE escape helper       | DRY           | S      |
| Document unpaginated tenants list policy | Scale clarity | S      |
| Tenants list optional pagination         | Future scale  | M      |

---

## 11. Go / No-Go for next phase

### A) Ready for manual multi-tenant QA?

**Y — with conditions:**

1. Use real Postgres + `seed:admin` + at least two tenants/users/memberships/orgs.
2. Explicitly test: session bind mismatch, missing `user.read` / `organization.read`, cross-tenant detail ids, pagination cursors, P8 filters.
3. Record results in a manual test record (mirror `tasks/manual-test-p4b-rbac.md`).
4. Do **not** treat passing `npm run check` alone as isolation proof.

### B) Ready to open ANY write route?

**N**

**Hard prerequisites:**

1. Complete High backlog (live isolation + HTTP AuthZ tests).
2. OpenAPI/ACF amend for any write being opened + idempotency audit.
3. Independent or scripted peer review of RLS impact for INSERT/UPDATE paths.
4. Explicit IMP gate per write family — freeze does **not** auto-open (FREEZE-ACC-001).

### C) Recommended single next engineering increment

**IMP-001-P10: Live product-read isolation matrix + OpenAPI sync for P8 filters and session-bind metadata** — one sprint, no writes.

---

## 12. Appendix

### Files reviewed (primary)

**Controllers:**  
`tenants.controller.ts`, `organizations.controller.ts`, `tenant-settings.controller.ts`,  
`memberships.controller.ts`, `users.controller.ts`

**Application / repositories:** matching `application/*.service.ts`, `repositories/*.repository.ts`

**Platform:**  
`require-permission.guard.ts`, `session-tenant-bind.ts`, `policy-evaluator.ts`,  
`membership-aware-permission.source.ts`, `cursor-pagination.ts`,  
`tenant-transaction.ts`, `user-rls-transaction.ts`, `auth.guards.ts`

**Contracts / governance:**  
`acf-001-identity-tenant.openapi.yaml`, `ACF-001-identity-tenant-slice.md`,  
`FREEZE_ACCEPTANCE_IDENTITY_TENANT.md`, `SOLO_OPERATOR_GOVERNANCE_NOTE.md`

**Task records:** IMP-001-P5, P5b, P5c, P5c-current, P5d, P6, P6b, P6c, P7, P7b, P8, P9

**Tests:** controller/service/repository `*.test.ts` under modules;  
`tests/tooling/p5-tenants-list.test.ts`, `p4-rbac-foundation.test.ts`,  
`tests/contract/openapi-harness.test.ts`, `tests/isolation/*.live.test.ts`,  
`app.bootstrap.smoke.test.ts`

**Migrations:** organizations, tenant_settings, membership RLS helpers

### Commands run + results

| Command               | Result                          | When                      |
| --------------------- | ------------------------------- | ------------------------- |
| `npm run check`       | **PASS** (326 tests, 1 skipped) | 2026-07-20 review session |
| `RUN_LIVE_DB_TESTS=1` | **NOT RUN**                     | —                         |

### Assumptions

- Review is static + unit/structural test evidence; no manual HTTP probing in this session.
- `PgPermissionSource` + RLS policies behave as migrated when DB available (prior AUDIT-R2 evidence trusted but not re-run).
- Solo-operator freeze remains legally/operationally accepted by project owner; this audit does not change that.

### Out-of-scope items noticed

- MFA, session list/revoke, role-admin HTTP — correctly absent.
- Frontend, non–Identity/Tenant BCs — not reviewed.
- Architecture Freeze v1.0 redesign — not proposed.
- **This document is not governance acceptance** and does not approve opening writes.

---

_End of AUDIT-R4_
