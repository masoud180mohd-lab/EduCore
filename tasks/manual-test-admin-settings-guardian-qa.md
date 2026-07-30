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

## Checklist — Settings (IMP-032 operator-safe)

| #   | Step                                                      | Expected                            | Pass? |
| --- | --------------------------------------------------------- | ----------------------------------- | ----- |
| 1   | Open Settings                                             | Known keys only; no JSON textarea   | **PASS** (browser 2026-07-28) |
| 2   | Set timezone / locale / currency → Save (Advanced closed) | Success; extras preserved on reload | **PASS** (API 2026-07-28) |
| 3   | Expand Advanced → edit JSON → Save                        | ConfirmDialog → success             | static ✓; Advanced toggle **PASS**; full save click ☐ |
| 4   | Invalid JSON → Save (Advanced open)                       | Client error, no PUT                | **PASS** (unit + browser 2026-07-28) |
| 5   | tenant.read only (no manage) → page                       | Read-only; no Save                  | browser ☐ |
| 6   | tenant.read only → PUT via API                            | 403                                 | browser ☐ |

## Checklist — Settings (legacy IMP-019)

| #   | Step                                    | Expected                   | Pass? |
| --- | --------------------------------------- | -------------------------- | ----- |
| 1   | Open Settings                           | Form (not “edit deferred”) |       |
| 2   | Set timezone / locale / currency → Save | Success banner; reload OK  |       |

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
| Date        | 2026-07-28 |
| Settings    | preserve-merge API PASS; see `docs/engineering/task-records/MANUAL-QA-ADMIN-POLISH-2026-07-28.md` |
| Guardian id | browser QA not run this session |
