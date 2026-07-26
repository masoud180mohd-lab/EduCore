# Manual QA — IMP-022 Roles Admin

Local lab. Requires admin with `role.read` / `role.manage` (seed owner).

## Prep

```powershell
npm run db:migrate
npm run start:dev
npm run dev:web
```

Login: `admin@educore.local` / `ChangeMe-Local-Only-1`

## Checklist

| #   | Step                                    | Expected                                     | Pass? |
| --- | --------------------------------------- | -------------------------------------------- | ----- |
| 1   | Admin nav → Roles                       | List shows system roles (owner/admin/staff…) |       |
| 2   | Create custom role (code + name)        | Redirect to detail                           |       |
| 3   | Detail: rename → Save name              | Banner success                               |       |
| 4   | Detail: check permissions → Save        | Permissions persist                          |       |
| 5   | Open system role (e.g. staff)           | Grants listed; no permission edit form       |       |
| 6   | Users → other user detail → Assign role | Assignment listed                            |       |
| 7   | Remove assignment                       | Gone from list                               |       |
| 8   | Parent / no role.manage → create/assign | 403                                          |       |

## Evidence

| Item    | Notes |
| ------- | ----- |
| Date    |       |
| Role id |       |
| User id |       |
