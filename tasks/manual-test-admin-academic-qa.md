# Manual QA — IMP-012 Admin Academic Structure UI

Local lab. Requires admin with `academic.read` / `academic.manage` (seed owner).

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

| #   | Step                                             | Expected                                      | Pass? |
| --- | ------------------------------------------------ | --------------------------------------------- | ----- |
| 1   | Admin home shows Academic card; nav has Academic | Yes                                           |       |
| 2   | Academic hub lists Years…Enrollments             | Yes                                           |       |
| 3   | Create academic year (active)                    | Detail read-only; appears in Fees year picker |       |
| 4   | Create term for that year                        | Listed under Terms                            |       |
| 5   | Create class (+ optional term)                   | Detail links to streams/enrollments           |       |
| 6   | Create stream for class                          | Listed                                        |       |
| 7   | Create subject                                   | Catalog list                                  |       |
| 8   | Enroll student in class                          | Detail shows names; status chip               |       |
| 9   | Change enrollment status (confirm)               | PATCH succeeds                                |       |
| 10  | No edit forms on year/term/class/stream/subject  | Read-only copy present                        |       |
| 11  | 403 without academic.manage                      | Honest banner on create                       |       |

## Evidence

| Item          | Notes |
| ------------- | ----- |
| Date          |       |
| Year id       |       |
| Class id      |       |
| Enrollment id |       |
| Status PATCH  |       |
