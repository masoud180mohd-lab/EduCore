# Manual QA — IMP-014 Academic Structure DELETE + Reparent

Local lab. Requires admin with `academic.manage`.

## Prep

```powershell
npm run db:migrate
$env:SEED_ADMIN_PASS='ChangeMe-Local-Only-1'
npm run seed:admin
npm run start:dev   # :3000
npm run dev:web     # :3001
```

## Checklist

| #   | Step                                              | Expected                    | Pass? |
| --- | ------------------------------------------------- | --------------------------- | ----- |
| 1   | Create empty subject → Delete                     | 204; gone from list         |       |
| 2   | Year with term → Delete year                      | 409 honest banner           |       |
| 3   | Move stream to another class (same tenant)        | PATCH 200; class id updates |       |
| 4   | Reparent term to another year                     | PATCH 200                   |       |
| 5   | Class: change year + clear/set term               | Saves                       |       |
| 6   | Parent without academic.manage → DELETE           | 403                         |       |
| 7   | Foreign UUID DELETE                               | 404                         |       |
| 8   | No cascade (children remain after blocked delete) | Yes                         |       |

## Evidence

| Item     | Notes |
| -------- | ----- |
| Date     |       |
| Subject  |       |
| 409      |       |
| Reparent |       |
