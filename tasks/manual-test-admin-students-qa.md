# Manual QA — IMP-015 Admin Students create + edit

Local lab. Requires admin with `student.manage` (seed owner).

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

| #   | Step                                     | Expected                      | Pass? |
| --- | ---------------------------------------- | ----------------------------- | ----- |
| 1   | Students list shows create form          | Yes                           |       |
| 2   | Create student (active, optional code)   | Redirect to detail            |       |
| 3   | Edit displayName / status → Save         | Banner success; list reflects |       |
| 4   | Duplicate studentCode on another student | 409 honest banner             |       |
| 5   | Clear student code (empty) → Save        | Code cleared                  |       |
| 6   | Search by name                           | Filtered list                 |       |
| 7   | No Delete control on detail              | Absent                        |       |
| 8   | Parent without student.manage → create   | 403                           |       |

## Evidence

| Item       | Notes |
| ---------- | ----- |
| Date       |       |
| Student id |       |
| 409        |       |
