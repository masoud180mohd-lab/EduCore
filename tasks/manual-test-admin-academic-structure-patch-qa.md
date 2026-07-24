# Manual QA — IMP-013 Academic Structure PATCH

Local lab. Requires admin with `academic.manage` (seed owner).

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

| #   | Step                                     | Expected                           | Pass? |
| --- | ---------------------------------------- | ---------------------------------- | ----- |
| 1   | Create academic year (or open existing)  | Detail shows edit form             |       |
| 2   | PATCH name + status → active             | Saves; Fees year picker shows name |       |
| 3   | Duplicate code on another year           | 409 honest banner                  |       |
| 4   | Foreign UUID in URL                      | 404                                |       |
| 5   | Edit term (name/dates/status)            | Saves                              |       |
| 6   | Edit class / stream / subject            | Saves; parent ids remain read-only |       |
| 7   | Set status → closed (confirm dialog)     | Confirms then saves                |       |
| 8   | Parent / staff without `academic.manage` | 403 on save                        |       |
| 9   | No DELETE control on detail              | Absent                             |       |

## Evidence

| Item     | Notes |
| -------- | ----- |
| Date     |       |
| Year id  |       |
| PATCH ok |       |
| 409 code |       |
| 403      |       |
