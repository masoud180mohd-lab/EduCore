# M9-003 — B-07 D3 secrets rotate rehearsal (staging)

| Field     | Value                                                                                                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Date      | 2026-08-27 (executed ~20:32–21:08 UTC)                                                                                                                                                |
| Program   | **M9** Pilot hardening — item 3                                                                                                                                                       |
| Governing | [`B-07-pilot-slos-restore-drill-schedule.md`](../decisions/B-07-pilot-slos-restore-drill-schedule.md) (drill D3) · [`M9-001-pilot-readiness-pack.md`](M9-001-pilot-readiness-pack.md) |
| Authority | SOLO-GOV-002; scheduled early by Owner direction (B-07 due date was 2026-12-15)                                                                                                       |
| Status    | **Pass**                                                                                                                                                                              |

## Objective

Execute the B-07 **D3** rehearsal on staging: rotate at least one non-prod key, confirm the app picks it up, and prove the old key is revoked. Staging only; production untouched.

## Pass criteria (per B-07) → evidence

| Criterion               | Result | Evidence                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rotate one non-prod key | ✅     | `scripts/ops-stg-rotate-db-passwords.mjs` under `doppler run --project educore --config stg`; Neon `ALTER ROLE` rotated staging roles `educore_app`, `educore_platform`, `educore_migrator`, `neondb_owner`; script probes with new credentials OK before writing Doppler; Doppler `stg` `DATABASE_URL` / `EDUCORE_APP_DATABASE_URL` / `SEED_PLATFORM_DATABASE_URL` updated |
| App picks up            | ✅     | `scripts/ops-stg-sync-fly-secrets.mjs` pushed 12 secrets to Fly `educore-api-staging` (optional `AUTH0_ALLOW_UNVERIFIED_EMAIL_LINK` skipped); releases advanced to **v91 complete**; machine checks passing; `GET https://educore-api-staging.fly.dev/health` → **200** at ~21:07 UTC (1144 ms)                                                                             |
| Old key revoked         | ✅     | Direct Postgres connection attempt with the pre-rotation `educore_app` credential rejected: `password authentication failed for user 'educore_app'`                                                                                                                                                                                                                         |

## Timeline (UTC)

| Time         | Event                                                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~20:32       | Baseline: health 200 (1227 ms), Fly release v66, one machine started                                                                                    |
| ~20:34       | Rotation executed (stg config guard, role allowlist, new-credential probes OK, Doppler stg updated)                                                     |
| ~20:38–21:04 | Secrets synced to Fly (releases v67 → v91; one earlier sync attempt interrupted at secret 2 by a client-side timeout and was re-run to full completion) |
| ~20:41       | Interim health 200 after first secret releases (auto-start on request)                                                                                  |
| ~21:00       | Old-key revocation probe: rejected by Neon                                                                                                              |
| ~21:07       | Final health 200 on v91                                                                                                                                 |

Expected side effect observed: brief staging DB-connection window between `ALTER ROLE` and Fly redeploy pickup. Staging only; no production impact.

## Incident note (honesty)

During preflight, a `doppler secrets` listing rendered staging secret values to the operator terminal. The rehearsal itself neutralized the exposed DB credentials by rotating and revoking them in the same session. Lesson recorded: enumerate Doppler secret **names only** in future preflight; capture values into non-printed variables. No secret values appear in this record.

## Explicit non-goals

- Production (`prd`) rotation — **not** touched.
- ClickPesa / Beem / Auth0 credential rotation — out of D3 scope (Auth0 staging client secret remains a candidate for a future rehearsal).
- Claiming any pilot school cutover.

## Next D3

Semi-annual cadence per B-07: next D3 due ≈ **2027-02-27** (record earlier if Owner schedules or on any suspected leak).

## Honesty

Pass of a rehearsal is evidence the rotation procedure works; it is not production readiness and not a public-pilot GO.
