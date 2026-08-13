# B-07 restore drill — 2026-08-13

| Field | Value |
| --- | --- |
| Env | staging Neon (`educore-staging-fra` / project `bitter-darkness-15594292`) |
| Start (UTC) | 2026-08-13T09:30:12.589Z |
| End (UTC) | 2026-08-13T09:30:21.060Z |
| RTO measured | 8s (branch create + spot-check + delete) |
| RPO assumed | Neon PITR / branch from primary head (`main`) |
| Pass / Fail | **Pass** |
| Owner | Project Owner / solo-operator (SOLO-GOV-001) |
| Notes | Ephemeral branch `drill-20260813-msrbhx69` created from primary, connected as `educore_app`, branch deleted. Fly app not rewired (DB-only drill per OPS-001). |

## Spot checks

| Check | Result |
| --- | --- |
| current_user (drill branch) | `educore_app` |
| current_database | `neondb` |
| schema_migrations count (app role) | 62 |
| tenants / memberships via `educore_app` without tenant GUC | 0 / 0 (0/0 expected under FORCE RLS) |

## Honesty

- This drill proves **branch clone + app-role connect** on B-05 Neon topology within **8s** (≪ RTO 8h).
- App-role zero counts without `app.current_tenant` are **RLS honesty**, not empty DB.
- It is **not** an in-place overwrite of primary via `^self@timestamp` (optional harder drill later).
- Prefer `NEON_PROJECT_ID` for Frankfurt (`educore-staging-fra`) when multiple Neon projects remain.
