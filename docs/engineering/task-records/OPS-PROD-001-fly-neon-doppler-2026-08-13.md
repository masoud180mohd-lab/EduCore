# OPS-PROD-001 — production Fly + Neon + Doppler (infra only)

| Field | Value |
| --- | --- |
| Date | 2026-08-13 |
| Status | **Infra live** — not Board production GO |
| Authority | Owner-authorized ops (SOLO-GOV-001) |
| Fly | `educore-api` (fra) `https://educore-api.fly.dev` |
| Neon | `educore-prod` (`weathered-cherry-17401184`) `aws-eu-central-1` PG16 |
| Doppler | `educore` / `prd` |
| Image | `registry.fly.io/educore-api:deployment-01KZXDG0B25HFYJ8F9C92R36M8` |
| Health (UTC) | 2026-08-13T11:21:09.552Z `{"status":"ok","service":"educore-api","environment":"production"}` |
| Machines | `d8d961e6a11308`, `e826d2dc43ee28` (fra; checks passing) |

## What ran

1. Bound existing Frankfurt Neon `educore-prod` to Doppler `prd` (`CONFIRM=YES` `ops-prod-provision-neon.mjs`). Host already `*.eu-central-1.aws.neon.tech` pooler.
2. `db:bootstrap-roles` then `db:migrate` (roles-first: migrate failed until `educore_app` existed).
3. `ops-prod-set-runtime-secrets.mjs` — Fake payments/SMS/AI; `AUTH_IDP_PROVIDER=local`; `MFA_ENFORCE=soft`.
4. Rotate DB role passwords into `prd` (`ops-stg-rotate-db-passwords.mjs` with `DOPPLER_TARGET_CONFIG=prd`; app + owner probes OK).
5. `seed:admin` → `admin@educore.prod` / tenant `prod-school` (password only in Doppler `prd`).
6. Fly secrets sync (app URL only; **no** owner `DATABASE_URL`; Auth0 not copied from staging).
7. `flyctl deploy -c infra/fly/educore-api.toml --remote-only` exit 0; `/health` green.

## Honesty

- `/health` `environment: production` is **NODE_ENV**, not Board GO (`42` still NO GO).
- Production IdP is **local** (staging Auth0 US was not copied).
- Production MFA is **soft** (staging remains hard).
- `PAYMENT_PROVIDER=fake` — no ClickPesa keys in Doppler.
- Neon PITR retention on this project is **6h** (plan max); not weekly restore window.
- Seed admin is a break-glass lab user (`SEED_ADMIN_ALLOW_PRODUCTION=1`), not public-school cutover.
- Retrieve prod admin password locally only: `doppler secrets get SEED_ADMIN_PASS --plain --project educore --config prd`.
