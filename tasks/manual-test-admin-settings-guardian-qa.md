# Manual QA — IMP-019 Admin Settings + Guardian profile edit

Local lab. Requires admin with `tenant.manage` and `guardian.manage` (seed owner).

## Prep

```powershell
npm run db:migrate
$env:SEED_ADMIN_PASS='ChangeMe-Local-Only-1'
npm run seed:admin
npm run start:dev   # :3000
npm run dev:web     # :3001
```

Login: `admin@educore.local` / `ChangeMe-Local-Only-1`

## Checklist — Settings

| #   | Step                                    | Expected                   | Pass? |
| --- | --------------------------------------- | -------------------------- | ----- |
| 1   | Open Settings                           | Form (not “edit deferred”) |       |
| 2   | Set timezone / locale / currency → Save | Success banner; reload OK  |       |
| 3   | Edit additional JSON → Save             | Merged into settings       |       |
| 4   | Invalid JSON → Save                     | Client error, no PUT       |       |
| 5   | Parent / no tenant.manage → Save        | 403                        |       |

## Checklist — Guardian profile

| #   | Step                                     | Expected                | Pass? |
| --- | ---------------------------------------- | ----------------------- | ----- |
| 6   | Open guardian detail                     | Profile form present    |       |
| 7   | Edit name / phone / email → Save profile | Success; fields persist |       |
| 8   | Duplicate email on another guardian      | 409                     |       |
| 9   | Bind / link student still work           | Unchanged               |       |

## Evidence

| Item        | Notes |
| ----------- | ----- |
| Date        |       |
| Settings    |       |
| Guardian id |       |
