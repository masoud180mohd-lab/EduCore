# ID-003-OPS — Provision Auth0 for staging

| Field | Value |
| --- | --- |
| Program | Staging Auth0 enablement after ID-003 |
| Date | 2026-08-09 |
| Status | **Done** + **SMOKE_PASS** (ID token → EduCore opaque session) |
| Script | `scripts/ops-stg-provision-auth0.mjs`, `scripts/ops-stg-auth0-smoke.mjs` |
| Tenant | `dev-ght4bps24glm825x` (US — residency residual vs EU preference) |
| Domain | `dev-ght4bps24glm825x.us.auth0.com` |

## Completed

1. Owner created Auth0 app `educore-api-staging` (Regular Web) + Doppler secrets.
2. Applied migration `20260809150000_auth_idp_external_subject` on FRA Neon.
3. Synced Auth0 secrets to Fly; redeployed ID-003 API.
4. Auth0 user `admin@educore.staging`; Password grant enabled by Owner.
5. **SMOKE_PASS** (`ops-stg-auth0-smoke.mjs`):
   - password login → tenant `01900000-0010-7000-8000-000000000001`
   - Auth0 ID token (password-realm)
   - IdP login → `ecs_` access token
   - `/auth/me` → `admin@educore.staging`

## Staging residual

- `AUTH0_ALLOW_UNVERIFIED_EMAIL_LINK=1` — Auth0 DB signup left `email_verified=false`; first-link allowed under this lab flag only.
- Prefer verifying the Auth0 user email in dashboard, then clear the flag later.
- Auth0 region US (not EU).
- Web Universal Login UI not built; password login remains enabled.
- ClickPesa / PAY-OPS still deferred.
- Production GO still NO GO.
