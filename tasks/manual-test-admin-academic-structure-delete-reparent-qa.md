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
| 1   | Create empty subject → Delete                     | 204; gone from list         | Pass  |
| 2   | Year with term → Delete year                      | 409 honest banner           | Pass  |
| 3   | Move stream to another class (same tenant)        | PATCH 200; class id updates | Pass  |
| 4   | Reparent term to another year                     | PATCH 200                   | Pass  |
| 5   | Class: change year + clear/set term               | Saves                       | Pass  |
| 6   | Parent without academic.manage → DELETE           | 403                         | Pass  |
| 7   | Foreign UUID DELETE                               | 404                         | Pass  |
| 8   | No cascade (children remain after blocked delete) | Yes                         | Pass  |

## Evidence

| Item     | Notes                                                                 |
| -------- | --------------------------------------------------------------------- |
| Date     | 2026-07-25 (API `:3000`)                                              |
| Mode     | Live HTTP against local Nest                                          |
| Subject  | Created then deleted `bec6fcc5-92a0-4d57-b42f-61b602c4d615` (204→404) |
| 409      | Year `4fdca3bc-3c94-4117-9fc1-df1c3311c2f7` DELETE → CONFLICT         |
| Reparent | Stream→class2; term→yearB; class yearA + term cleared                 |
| 403      | `parent@educore.local` DELETE subject → 403                           |
| 404      | Foreign subject DELETE                                                |
| Cascade  | Term `442f4f2c-ee86-4faf-b835-1e158938204d` still GET 200 after 409   |
| Commit   | `646c3c8` on `origin/main`                                            |
