# Manual QA — IMP-023 Admin Memberships list

Local lab. Requires `user.read`.

## Prep

```powershell
npm run start:dev
npm run dev:web
```

Login: `admin@educore.local` / `ChangeMe-Local-Only-1`

## Checklist

| #   | Step                                 | Expected          | Pass? |
| --- | ------------------------------------ | ----------------- | ----- |
| 1   | Nav → Memberships                    | List loads        |       |
| 2   | Filter Active → Apply                | Only active rows  |       |
| 3   | Filter Suspended / Invited / Removed | Matches statuses  |       |
| 4   | Click a row                          | Opens user detail |       |
| 5   | Parent without user.read             | 403               |       |

## Evidence

| Item | Notes |
| ---- | ----- |
| Date |       |
