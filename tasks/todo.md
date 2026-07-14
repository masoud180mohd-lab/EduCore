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

- Add `tenant_memberships` + redefine membership hook (after isolation evidence)
- Feature APIs only after full freeze acceptance
