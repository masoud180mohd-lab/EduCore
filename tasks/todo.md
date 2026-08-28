# Operator / verification — current

- [x] Phase 2 RLS hardening + live suite (skip without DB)
- [x] Phase 3 docs, barrels, CI baseline (`d68142a`)
- [x] Fix migration order: `user_has_active_membership` before `can_see_tenant`
- [x] Install local PostgreSQL 16 (native; Docker Desktop install stalled on download)
- [x] Create `educore` DB, run `db:migrate` + `db:bootstrap-roles`
- [x] Run live RLS isolation suite with `RUN_LIVE_DB_TESTS=1` — **5 passed, 1 skipped**
- [x] Operator script `scripts/run-live-db-tests.ps1`
- [ ] Optional: Docker Desktop later (Redis + compose parity) if needed
- [ ] Optional: `git remote` + push + branch protection required checks
- [x] Human freeze signatures (DBF-001 / ACF-001) — **solo-operator** ([SOLO-GOV-001](../docs/engineering/governance/SOLO_OPERATOR_GOVERNANCE_NOTE.md))

## Next product work

- [x] `tenant_memberships` + real membership helpers + OpenAPI hardening
- [x] IMP-001 Phase P2 request platform & auth plumbing (conditional freeze / ADR-012)
- [x] P2 improvement: DB-backed `TenantMembershipChecker` + optional Nest `educore_app` pool
- [x] P2 improvement: Nest `PermissionSource` from roles / role_permissions (membership gate wired)
- [x] IMP-001 Phase P3 AuthN sessions + login/refresh/logout (ADR-012)
- [x] P3 improvement: local admin seed (`npm run seed:admin`)
- [x] P3 improvement: /auth/me, select-tenant, HttpOnly refresh, rate limit backends
- [x] IMP-001 Phase P4 RBAC foundation (system roles seed, RequirePermission tests, /auth/me permissions) — ADR-012
- [x] P4b: session↔header tenant bind + system grant reconciler (`rbac:reconcile-grants`)
- [x] P4c: `/auth/me` roles↔permissions membership consistency
- [x] P4d: fail-closed AuthZ/membership warn logging (ops visibility)
- [x] P5 / P5b: `GET /api/v1/tenants` + `GET /api/v1/tenants/{id}`
- [x] P5c: get-by-id requires `tenant.read` + path/`X-Tenant-Id` match
- [x] P5d: fail-closed warn-log on tenants repo + OpenAPI/ACF amend (list + get AuthZ)
- [x] AUDIT-R4: read increments review (`docs/engineering/task-records/AUDIT-R4-read-increments-review.md`)
- [x] P10: HTTP AuthZ integration + live read isolation matrix + OpenAPI P8/sync (AUDIT-R4 High)
- [x] P11: cursor UUID validation + users cursor tenant scope + Q5 invited list
- [x] P12: `GET /users/{id}` + OpenAPI/ACF honesty update (AUDIT-R4 Medium)
- [x] P13: shared ILIKE helper + tenants picker unpaginated policy / soft cap (AUDIT-R4 Low)
- [x] Manual multi-tenant QA script: `tasks/manual-test-product-reads-qa.md` (operator run checklist)
- [ ] Manual verify P4b: follow `tasks/manual-test-p4b-rbac.md`
- [ ] Manual verify product reads: follow `tasks/manual-test-product-reads-qa.md`
- [x] **Governance closed (SOLO-GOV-001):** acting countersignatures + DBF/ACF Freeze v1.0 + FREEZE-ACC Accepted — theoretical roles consolidated; outbox send N/A
- [x] Next product: gated IMP increments (tenant CRUD / invites) only with explicit plan — freezes do not auto-open every OpenAPI path
- [ ] P3 follow-ups: MFA, session list/revoke (optional)
- [ ] Role-admin HTTP (blocked until Freeze v1.0)
- Optional: git commit + GitHub push (operator)
