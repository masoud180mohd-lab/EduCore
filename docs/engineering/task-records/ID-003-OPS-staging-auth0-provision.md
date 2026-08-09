# ID-003-OPS — Provision Auth0 for staging

| Field | Value |
| --- | --- |
| Program | Staging Auth0 enablement after ID-003 |
| Date | 2026-08-09 |
| Status | **Done** + **SMOKE_PASS** (with lab flag **removed**) |
| Script | `scripts/ops-stg-provision-auth0.mjs`, `scripts/ops-stg-auth0-smoke.mjs` |
| Tenant | `dev-ght4bps24glm825x` (US — residency residual vs EU preference) |
| Domain | `dev-ght4bps24glm825x.us.auth0.com` |

## Completed

1. Owner created Auth0 app + Doppler secrets; migration + Fly + redeploy.
2. Auth0 user `admin@educore.staging`; Password grant enabled.
3. **SMOKE_PASS** (ID token → opaque session → `/auth/me`).
4. **`AUTH0_ALLOW_UNVERIFIED_EMAIL_LINK` removed** from Doppler `stg` + Fly (2026-08-09).
5. Re-smoke **PASS** after flag removal (login by linked `external_subject_id` / Auth0 `sub`).

## Owner hygiene (optional)

Auth0 → Users → `admin@educore.staging` → set **Email Verified** (recommended; not required for linked sub login).

## Residuals

- Auth0 region US (not EU).
- Web Universal Login UI not built; password login remains enabled.
- ClickPesa / PAY-OPS deferred by Owner.
- Production GO still NO GO.

## Ops note

`doppler secrets delete` may print a full config table to the terminal — treat that host log as sensitive; rotate if logs were shared.
