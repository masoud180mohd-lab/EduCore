# Manual QA — IMP-011-PX1 Parent demo path

Local lab only. MoMo / parent pay remain **blocked** (PAY-PROVIDER-001).

## Prep

```powershell
npm run db:migrate
# Optional (migrator/superuser DATABASE_URL — educore_app will fail with permission denied):
npm run rbac:reconcile-grants -- --all-tenants

$env:SEED_ADMIN_PASS='ChangeMe-Local-Only-1'
npm run seed:admin

$env:SEED_PARENT_PASS='ChangeMe-Parent-Local-1'
npm run seed:parent-demo
```

## Checklist

| #   | Step                                                         | Expected                                            | Pass?                                                                                         |
| --- | ------------------------------------------------------------ | --------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1   | Migrate                                                      | No pending / applied                                | **PASS** (2026-07-23)                                                                         |
| 2   | seed:admin + seed:parent-demo                                | Prints parentEmail, guardianId, studentId           | **PASS**                                                                                      |
| 3   | Admin login → Guardians → Demo Parent Guardian → Portal bind | User **select** lists users (not UUID-primary)      | **PASS** (API: GET /users n=2 incl. parent; page HTTP 200; picker in source)                  |
| 4   | If already bound by seed                                     | Shows display name + muted id; Unbind works         | **PASS** (guardian.userId bound to parent user)                                               |
| 5   | Parent login `parent@educore.local`                          | Lands `/t/{tenantId}/parent`                        | **PASS** (login 200; `prefersParentHome` true via `parent.guardian.read`; `/parent` HTTP 200) |
| 6   | Parent home                                                  | Linked “Demo Linked Student”                        | **PASS** (GET /me/guardian/links n=1 active → student …023)                                   |
| 7   | Bursar issues invoice for seeded studentId                   | Appears under parent student invoices               | **PASS** (issued invoice; parent list n=1)                                                    |
| 8   | Open invoice on parent surface                               | Lines + balance; **no** Issue/Pay/Reverse/Reconcile | **PASS** (detail 200 balance=50000 lines=1; parent POST issue → 403; UI banners only)         |
| 9   | Guess other student’s invoice id                             | Forbidden / isolation message                       | **PASS** (fake invoice **404**; unlinked studentId list **403**)                              |
| 10  | Banner                                                       | Pay at office; mobile money not enabled             | **PASS** (PAY-PROVIDER-001 on all parent pages)                                               |

## Evidence (operator)

| Item           | Notes                                                                      |
| -------------- | -------------------------------------------------------------------------- |
| Date           | 2026-07-23                                                                 |
| Migrate        | No pending                                                                 |
| Seed           | parent@educore.local / guardian …022 / student …023 (idempotent)           |
| Bind picker    | GET /users?limit=50 returns parent; primary control `bindUserSelect`       |
| Parent routing | Permissions drive `/parent` (roles array empty on /auth/me — see residual) |
| Isolation      | 404 unknown invoice; 403 other studentId                                   |
| MoMo blocked   | Yes — no pay UI; parent cannot POST issue                                  |
| Invoice used   | `130aa195-13f2-41f3-bd14-34650f7702ae` (issued, balance 50000)             |

## Residual

- `/auth/me` returned **empty `roles`** for parent (and likely admin) while `permissions` were correct. Parent routing still works via `parent.guardian.read`. Admin UI routing may fall through to staff if owner/admin role codes are missing — investigate separately if admin login lands on `/teacher`.
- Browser click-path (GUI) not exercised (no browser MCP); API + page HTTP + routing helper + UI source scan used instead.
