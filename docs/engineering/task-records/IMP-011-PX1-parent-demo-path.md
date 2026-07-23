# IMP-011-PX1 — Parent demo path (bind UX + seed/QA)

| Field   | Value                                    |
| ------- | ---------------------------------------- |
| Program | **IMP-011-PX1**                          |
| Date    | 2026-07-23                               |
| Depends | IMP-011-PX (DBF-011 / ACF-013 / DSF-006) |
| MoMo    | Still blocked (PAY-PROVIDER-001)         |

## Wave 1 — Migrate / reconcile

Commands used:

```powershell
npm run db:migrate
# → No pending migrations (guardian portal bind already applied).

npm run rbac:reconcile-grants -- --all-tenants
# → FAILED here: permission denied for table roles
#    Cause: DATABASE_URL pointed at a non-migrator role (e.g. educore_app).
#    Fix: use migrator/superuser DATABASE_URL, then re-run.
#    Note: migration 20260723170000 already INSERTs parent role + parent.* grants
#    for existing tenants; reconcile is for matrix drift after TS changes.
```

## Wave 2 — Bind picker

- Guardian detail **Portal bind** primary control = `<select>` from `GET /api/v1/users?limit=50`.
- Labels via `formatUserBindLabel` (displayName + email).
- Advanced disclosure: paste UUID.
- 403 / empty / 409 honest copy.
- DSF-006 amended to v1.1 (picker UX).

## Wave 3 — Seed

```powershell
$env:SEED_PARENT_PASS='…'
npm run seed:parent-demo
```

- Platform phase: user + membership + parent role + student.
- App phase (`EDUCORE_APP_DATABASE_URL` / educore_app): `create_guardian` + `bind_guardian_user` + link.
- Example output (local): parentEmail `parent@educore.local`, stable UUIDs under `01900000-0010-…`.
- Invoices: still via bursar Fees UI (IMP-010) — no invented ledger posts.

## Wave 4 — Manual QA

Checklist: `tasks/manual-test-parent-demo-qa.md`.

Executed in this environment:

| Check                                  | Result                                                        |
| -------------------------------------- | ------------------------------------------------------------- |
| db:migrate                             | Pass (no pending)                                             |
| seed:parent-demo                       | Pass (user/guardian/student/link created)                     |
| Bind picker code                       | Pass (tooling + page)                                         |
| Full browser login → /parent → invoice | Residual — needs running API+web + bursar invoice for student |
| Isolation                              | Residual — same (server ACF-013 already enforced)             |
| MoMo blocked                           | Pass (no pay UI; docs cite PAY-PROVIDER-001)                  |

## Doubt checks

| Check                             | Answer                       |
| --------------------------------- | ---------------------------- |
| Admin bind without UUID paste?    | Yes — picker primary         |
| Seed+migrate demo &lt;15 min?     | Yes, after seed:admin        |
| Parent see other student invoice? | Must not (ACF-013 allowlist) |
| MoMo blocked?                     | Yes                          |

## Verification

```bash
npm run check
```

## Next

PAY-PROVIDER supersede for MoMo — only when product asks; not this program.
