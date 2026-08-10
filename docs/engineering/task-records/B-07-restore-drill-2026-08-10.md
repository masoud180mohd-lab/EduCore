# B-07 restore drill — 2026-08-10

| Field | Value |
| --- | --- |
| Env | staging Neon (`educore-staging-fra` / project `bitter-darkness-15594292`, `aws-eu-central-1`) |
| Start (UTC) | 2026-08-10T15:49:04.364Z |
| End (UTC) | 2026-08-10T15:49:13.861Z |
| RTO measured | 9s (branch create + spot-check + delete) |
| RPO assumed | Neon PITR / branch from primary head (`main`) |
| Pass / Fail | **Pass** |
| Owner | Project Owner / solo-operator (SOLO-GOV-001) |
| Notes | Ephemeral branch `drill-20260810-msneplry` created from primary, connected as `educore_app`, branch deleted. Fly app not rewired (DB-only drill per OPS-001). Re-check after INFRA-002 Frankfurt cutover (prior Pass: 2026-08-08 on legacy US project). |

## Spot checks

| Check | Result |
| --- | --- |
| current_user (drill branch) | `educore_app` |
| current_database | `neondb` |
| schema_migrations count (app role) | 61 |
| tenants / memberships via `educore_app` without tenant GUC | 0 / 0 (expected under FORCE RLS) |

## Honesty

- This drill proves **branch clone + app-role connect** on B-05 Neon **Frankfurt** topology within **9s** (≪ RTO 8h).
- App-role zero counts without `app.current_tenant` are **RLS honesty**, not empty DB.
- It is **not** an in-place overwrite of primary via `^self@timestamp` (optional harder drill later).
- Legacy us-east-2 project may still exist; app uses FRA (`DATABASE_URL` / Fly).
- Prefer `NEON_PROJECT_ID=bitter-darkness-15594292` when running `ops-d1-restore-drill.mjs` if multiple Neon projects remain.
