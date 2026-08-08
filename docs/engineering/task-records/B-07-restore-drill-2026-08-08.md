# B-07 restore drill — 2026-08-08

| Field | Value |
| --- | --- |
| Env | staging Neon (`educore-staging` / project `lively-wildflower-02524171`) |
| Start (UTC) | 2026-08-08T22:16:00.622Z |
| End (UTC) | 2026-08-08T22:16:06.984Z |
| RTO measured | 6s (branch create + spot-check + delete) |
| RPO assumed | Neon PITR / branch from primary head (`production`) |
| Pass / Fail | **Pass** |
| Owner | Project Owner / solo-operator (SOLO-GOV-001) |
| Notes | Ephemeral branch `drill-20260808-mskxnhv4` created from primary, connected as `educore_app`, branch deleted. Fly app not rewired (DB-only drill per OPS-001). |

## Spot checks

| Check | Result |
| --- | --- |
| current_user (drill branch) | `educore_app` |
| current_database | `neondb` |
| schema_migrations count (app role) | 60 |
| tenants / memberships via `educore_app` without tenant GUC | 0 / 0 (expected under FORCE RLS) |
| Primary owner counts (post-drill verify) | tenants=1, memberships=1, users=1 |

## Honesty

- This drill proves **branch clone + app-role connect** on B-05 Neon topology within **6s** (≪ RTO 8h).
- App-role zero counts without `app.current_tenant` are **RLS honesty**, not empty DB.
- It is **not** an in-place overwrite of primary via `^self@timestamp` (optional harder drill later).
- `educore_app` password still lab bootstrap until rotated.
- Rotate any Neon API keys / DB passwords previously pasted into chat.
