# INFRA-002-CUTOVER — Neon staging → Frankfurt

| Field       | Value                                                                                          |
| ----------- | ---------------------------------------------------------------------------------------------- |
| Date        | 2026-08-09                                                                                     |
| Status      | **Done**                                                                                       |
| Decision    | Supersedes residual in `INFRA-002-staging-neon-region-residual.md`                             |
| New project | `educore-staging-fra` (`bitter-darkness-15594292`) **`aws-eu-central-1`**                      |
| Legacy      | Previous us-east-2 URL preserved as Doppler `DATABASE_URL_LEGACY_USEAST2` (do not use for app) |

## Delivered

- Created Neon project in Frankfurt
- Doppler `DATABASE_URL` / app / platform URLs pointed at EU
- Bootstrap + migrate + password rotate + admin seed
- Fly secrets synced; `/health` OK; login smoke OK
- Fixed `ops-stg-prepare-admin-seed.mjs` so it no longer overwrites rotated platform URL with lab password

## Operator notes

- Old us-east-2 project may be deleted in Neon console when Owner confirms no need
- Retrieve admin pass: `doppler secrets get SEED_ADMIN_PASS --plain --project educore --config stg`
