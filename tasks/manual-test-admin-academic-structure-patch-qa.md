# Manual QA — IMP-013 Academic Structure PATCH

Local lab. Requires admin with `academic.manage` (seed owner).

## Prep

```powershell
npm run db:migrate
$env:SEED_ADMIN_PASS='ChangeMe-Local-Only-1'
npm run seed:admin
$env:SEED_PARENT_PASS='ChangeMe-Parent-Local-1'
$env:SEED_PARENT_RESET='1'
npm run seed:parent-demo
npm run start:dev   # :3000
npm run dev:web     # :3001
```

Login admin: `admin@educore.local` / `ChangeMe-Local-Only-1`  
Login parent (403 case): `parent@educore.local` / `SEED_PARENT_PASS`

## Checklist

| #   | Step                                     | Expected                           | Pass? |
| --- | ---------------------------------------- | ---------------------------------- | ----- |
| 1   | Create academic year (or open existing)  | Detail shows edit form             | Pass  |
| 2   | PATCH name + status → active             | Saves; Fees year picker shows name | Pass  |
| 3   | Duplicate code on another year           | 409 honest banner                  | Pass  |
| 4   | Foreign UUID in URL                      | 404                                | Pass  |
| 5   | Edit term (name/dates/status)            | Saves                              | Pass  |
| 6   | Edit class / stream / subject            | Saves; parent ids remain read-only | Pass  |
| 7   | Set status → closed (confirm dialog)     | Confirms then saves                | Pass  |
| 8   | Parent / staff without `academic.manage` | 403 on save                        | Pass  |
| 9   | No DELETE control on detail              | Absent                             | Pass  |

## Evidence

| Item     | Notes                                                        |
| -------- | ------------------------------------------------------------ |
| Date     | 2026-07-24 (API `:3000`, web `:3001`)                        |
| Mode     | Live HTTP against local Nest (API-level + web page smoke)    |
| Year id  | `064687a4-5e87-483e-b584-68db2f852c8c`                       |
| Term id  | `6125bf2d-16d3-448c-bcf5-82a65a78f701`                       |
| Class id | `b3de094f-3126-4900-8c3b-3418c94ab1cf`                       |
| PATCH ok | Years/terms/classes/streams/subjects → 200; close → `closed` |
| 409 code | PATCH duplicate code → 409                                   |
| 404      | Foreign year GET/PATCH → 404                                 |
| 403      | `parent@educore.local` PATCH year → 403                      |
| DELETE   | DELETE year → 404 (route absent)                             |
| Web      | `/admin/academic` + year detail → 200                        |
| Commit   | `5a5821b` on `origin/main`                                   |
