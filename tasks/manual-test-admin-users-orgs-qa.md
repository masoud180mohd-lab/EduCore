# Manual QA — IMP-016 Admin Users/Orgs + Nest writes

Local lab. Requires admin with `organization.manage`, `user.invite`, `user.manage` (seed owner).

## Prep

```powershell
npm run db:migrate
$env:SEED_ADMIN_PASS='ChangeMe-Local-Only-1'
npm run seed:admin
npm run start:dev   # :3000
npm run dev:web     # :3001
```

Login: `admin@educore.local` / `ChangeMe-Local-Only-1`

## Checklist — Organizations

| #   | Step                                        | Expected                       | Pass? |
| --- | ------------------------------------------- | ------------------------------ | ----- |
| 1   | Organizations list shows create form        | Yes                            |       |
| 2   | Create org (school, name, optional code)    | Redirect to detail             |       |
| 3   | Edit name/code → Save                       | Banner success                 |       |
| 4   | Duplicate code on another org               | 409 honest banner              |       |
| 5   | Deactivate → confirm                        | Status inactive; no Delete btn |       |
| 6   | Parent without organization.manage → create | 403                            |       |

## Checklist — Users

| #   | Step                                       | Expected              | Pass? |
| --- | ------------------------------------------ | --------------------- | ----- |
| 7   | Users list shows invite form               | Yes                   |       |
| 8   | Invite staff (email + staff role)          | Success banner        |       |
| 9   | Open an active user detail → rename → Save | Banner success        |       |
| 10  | Disable another user (not self) → confirm  | Status disabled       |       |
| 11  | Try disable self (same account)            | 403                   |       |
| 12  | Duplicate invite for active member         | 409                   |       |
| 13  | Parent without user.invite / user.manage   | 403 on invite/disable |       |

## Evidence

| Item      | Notes |
| --------- | ----- |
| Date      |       |
| Org id    |       |
| User id   |       |
| 409 / 403 |       |
