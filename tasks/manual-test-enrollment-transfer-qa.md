# Manual QA — IMP-018 Enrollment transfer

Local lab. Requires admin with `academic.manage`.

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

| #   | Step                                                    | Expected                               | Pass? |
| --- | ------------------------------------------------------- | -------------------------------------- | ----- |
| 1   | Open enrollment detail                                  | Transfer form + status form            |       |
| 2   | Transfer to another class (optional stream)             | Same enrollment id; year matches class |       |
| 3   | Clear stream (None) → Transfer                          | streamId null                          |       |
| 4   | Transfer into class where student already open-enrolled | 409 banner                             |       |
| 5   | Status → withdrawn still works                          | Status updates                         |       |
| 6   | No Delete control                                       | Absent                                 |       |
| 7   | Parent / no academic.manage → Transfer                  | 403                                    |       |

## Evidence

| Item          | Notes |
| ------------- | ----- |
| Date          |       |
| Enrollment id |       |
| 409 / 403     |       |
