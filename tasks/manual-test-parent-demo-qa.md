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

| #   | Step                                                         | Expected                                            | Pass? |
| --- | ------------------------------------------------------------ | --------------------------------------------------- | ----- |
| 1   | Migrate                                                      | No pending / applied                                |       |
| 2   | seed:admin + seed:parent-demo                                | Prints parentEmail, guardianId, studentId           |       |
| 3   | Admin login → Guardians → Demo Parent Guardian → Portal bind | User **select** lists users (not UUID-primary)      |       |
| 4   | If already bound by seed                                     | Shows display name + muted id; Unbind works         |       |
| 5   | Parent login `parent@educore.local`                          | Lands `/t/{tenantId}/parent`                        |       |
| 6   | Parent home                                                  | Linked “Demo Linked Student”                        |       |
| 7   | Bursar issues invoice for seeded studentId                   | Appears under parent student invoices               |       |
| 8   | Open invoice on parent surface                               | Lines + balance; **no** Issue/Pay/Reverse/Reconcile |       |
| 9   | Guess other student’s invoice UUID                           | Forbidden / isolation message                       |       |
| 10  | Banner                                                       | Pay at office; mobile money not enabled             |       |

## Evidence (operator)

| Item           | Notes           |
| -------------- | --------------- |
| Date           |                 |
| Migrate        |                 |
| Seed           |                 |
| Bind picker    |                 |
| Parent routing |                 |
| Isolation      |                 |
| MoMo blocked   | Yes — no pay UI |
