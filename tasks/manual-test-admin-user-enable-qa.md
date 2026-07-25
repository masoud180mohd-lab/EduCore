# Manual QA — IMP-021 User re-enable

Local lab. Requires admin with `user.manage`.

## Prep

```powershell
npm run db:migrate
npm run start:dev
npm run dev:web
```

Login: `admin@educore.local` / `ChangeMe-Local-Only-1`

## Checklist

| #   | Step                                               | Expected                      | Pass? |
| --- | -------------------------------------------------- | ----------------------------- | ----- |
| 1   | Open another user detail → Disable → confirm       | Status disabled               |       |
| 2   | Try login as that user                             | Sign-in rejected              |       |
| 3   | Admin: Enable user → confirm                       | Status active; banner success |       |
| 4   | Login as that user again                           | Works                         |       |
| 5   | Own detail → Enable (if shown) / self-disable path | Enable disabled or 403        |       |
| 6   | Parent without user.manage → enable                | 403                           |       |

## Evidence

| Item | Notes |
| ---- | ----- |
| Date |       |
| User |       |
