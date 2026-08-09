# ID-003-OPS — Provision Auth0 for staging

| Field | Value |
| --- | --- |
| Program | Staging Auth0 enablement after ID-003 |
| Date | 2026-08-09 |
| Status | **Blocked on Owner Auth0 tenant** (tooling + script ready) |
| Script | `scripts/ops-stg-provision-auth0.mjs` |

## Why blocked

Auth0 **tenant creation** requires an Owner Auth0 account (prefer **EU**). Doppler `educore`/`stg` currently has **no** `AUTH0_*` secrets. Auth0 CLI download on this host was unreliable (corrupt/partial zip); Management API mode does not need the CLI once M2M credentials exist.

## Owner one-time (5–10 min)

1. Sign in at [manage.auth0.com](https://manage.auth0.com/) → create tenant (prefer **EU**).
2. **Applications → Create Application**
   - Name: `educore-api-staging`
   - Type: **Regular Web Application**
   - Allowed Callback URLs: `https://educore-api-staging.fly.dev/auth/callback,http://localhost:3001/auth/callback`
   - Allowed Logout URLs: `https://educore-api-staging.fly.dev/,http://localhost:3001/`
   - Allowed Web Origins: `https://educore-api-staging.fly.dev,http://localhost:3001`
3. Copy **Domain**, **Client ID**, **Client Secret** (do not paste into chat).
4. In Doppler `educore` / `stg` (names only):

```powershell
doppler secrets set AUTH0_DOMAIN="YOUR_TENANT.eu.auth0.com" --project educore --config stg
doppler secrets set AUTH0_CLIENT_ID="..." --project educore --config stg
doppler secrets set AUTH0_CLIENT_SECRET="..." --project educore --config stg
doppler secrets set AUTH_IDP_PROVIDER=auth0 --project educore --config stg
```

### Optional: automate app create next time

Create an Auth0 **Machine to Machine** app authorized for Management API (`create:clients`, `update:clients`, `read:clients`), put `AUTH0_MGMT_CLIENT_ID` / `AUTH0_MGMT_CLIENT_SECRET` in Doppler, then:

```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
doppler run --project educore --config stg -- node scripts/ops-stg-provision-auth0.mjs
```

## After secrets are set (agent or Owner)

```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
doppler run --project educore --config stg -- npm run db:migrate
node scripts/ops-stg-sync-fly-secrets.mjs
```

Create Auth0 user with email `admin@educore.staging` (matches seed) so first-link / sub mapping works. Password login stays enabled.

## Delivered in repo (this slice)

- `scripts/ops-stg-provision-auth0.mjs`
- Fly sync includes Auth0 secrets when `AUTH_IDP_PROVIDER=auth0`
- This task record

## Explicitly not done until Owner tenant exists

- Live Auth0 tenant / app
- Doppler Auth0 values
- Fly Auth0 secret push
- Staging assertion smoke
