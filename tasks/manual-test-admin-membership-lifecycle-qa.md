# Manual QA — IMP-020 Membership suspend / reactivate / remove

Local lab. Requires admin with `user.manage` (seed owner). Second staff user recommended (invite first).

## Prep

```powershell
npm run db:migrate
$env:SEED_ADMIN_PASS='ChangeMe-Local-Only-1'
npm run seed:admin
npm run start:dev   # :3000
npm run dev:web     # :3001
```

Login: `admin@educore.local` / `ChangeMe-Local-Only-1`

## Checklist

| #   | Step                                                        | Expected                                      | Pass? |
| --- | ----------------------------------------------------------- | --------------------------------------------- | ----- |
| 1   | Users → invite a staff user (if needed) → open their detail | Membership status shown (invited/active)      |       |
| 2   | Suspend membership → confirm                                | Status `suspended`; banner success            |       |
| 3   | Suspended user cannot use tenant (login/bind as that user)  | Access denied / no active membership          |       |
| 4   | Stay on detail (or reopen via URL) → Reactivate → confirm   | Status `active`; access restored              |       |
| 5   | Suspend again → Remove → confirm                            | Status `removed`                              |       |
| 6   | Users list → invite same email again                        | Membership becomes `invited` (re-invite path) |       |
| 7   | Own user detail → Suspend / Remove                          | Buttons disabled or 403                       |       |
| 8   | Parent / no `user.manage` → lifecycle actions               | 403 honest banner                             |       |

## Evidence

| Item            | Notes |
| --------------- | ----- |
| Date            |       |
| Target user id  |       |
| Membership id   |       |
| 403 / re-invite |       |
