# FLY-WEB-001 — Next.js on Fly (staging + prod)

| Field     | Value                     |
| --------- | ------------------------- |
| Date      | 2026-08-14                |
| Status    | **Done**                  |
| Authority | Owner + AI (SOLO-GOV-002) |

## Delivered

| App                   | URL                                 | `/health` |
| --------------------- | ----------------------------------- | --------- |
| `educore-web-staging` | https://educore-web-staging.fly.dev | ok        |
| `educore-web`         | https://educore-web.fly.dev         | ok        |

- `apps/web/Dockerfile` (standalone Next 15)
- `infra/fly/educore-web.staging.toml` / `educore-web.toml` (`fra`)
- API `CORS_ORIGINS` allowlist (`cors-origins.ts`) + Fly `[env]`
- Web `/health` route

API bases baked at build: staging → `educore-api-staging.fly.dev`; prod → `educore-api.fly.dev`.

## How to use

1. Open the web URL → `/login`.
2. Password login against that env’s API. Prod MFA is **hard** — TOTP required for admin.
3. Fees: office cash/bank/cheque (PAY-007).

Auth0 on staging web needs callback `https://educore-web-staging.fly.dev/auth/callback` in the Auth0 app (not done here). Password login works without that.

## Not claimed

Mixx/M-Pesa, custom domain, or public-school cutover.
