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
- [ ] Human freeze signatures (DBF-001 / ACF-001)

## Next product work

- [x] `tenant_memberships` + real membership helpers + OpenAPI hardening
- [x] IMP-001 Phase P2 request platform & auth plumbing (conditional freeze / ADR-012)
- [x] P2 improvement: DB-backed `TenantMembershipChecker` + optional Nest `educore_app` pool
- [x] P2 improvement: Nest `PermissionSource` from roles / role_permissions (membership gate wired)
- [ ] P3 AuthN (login/sessions) only after GO or continued ADR-012 exception
- [ ] Real DB-backed TokenValidator when AuthN opens
- Optional: git commit + GitHub push (operator)
