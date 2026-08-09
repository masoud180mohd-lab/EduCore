# ID-003-OPS — Provision Auth0 for staging

| Field | Value |
| --- | --- |
| Program | Staging Auth0 enablement after ID-003 |
| Date | 2026-08-09 |
| Status | **Done** (tenant + Doppler + migrate + Fly) |
| Script | `scripts/ops-stg-provision-auth0.mjs` |
| Tenant | `dev-ght4bps24glm825x` (US — residency residual vs EU preference) |
| Domain | `dev-ght4bps24glm825x.us.auth0.com` |

## Completed

1. Owner created Auth0 app `educore-api-staging` (Regular Web) + Doppler secrets.
2. Applied migration `20260809150000_auth_idp_external_subject` on FRA Neon.
3. Synced Auth0 secrets to Fly `educore-api-staging` (`AUTH_IDP_PROVIDER=auth0`).
4. **Redeployed** API image with ID-003 code (`flyctl deploy …staging.toml --remote-only`).
5. Smoke: bad `idpAssertion` → `INVALID_CREDENTIALS` (path **enabled**; not “not enabled”). `/health` → 200.

## Auth0 login smoke (in progress)

**Done so far**
- EduCore password login OK → tenant `01900000-0010-7000-8000-000000000001`
- Auth0 user **`admin@educore.staging`** created (first signup succeeded)
- Password grant **not** enabled on app → automated ID-token mint blocked
- Script: `scripts/ops-stg-auth0-smoke.mjs` (password grant, else PKCE → `localhost:3001`)

**Owner — pick one, then re-run**

### Option A (rahisi): washa Password grant
1. Auth0 → Applications → `educore-api-staging` → Settings → **Advanced Settings** → **Grant Types**
2. Tick **Password** (na Password Realm ikiwaipo)
3. Save
4. Sema **sawa** — agent ataendesha tena:

```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
doppler run --project educore --config stg -- node scripts/ops-stg-auth0-smoke.mjs
```

### Option B: PKCE (browser)
Run command hiyo hapo juu; browser itafunguka — login `admin@educore.staging` kwa **SEED_ADMIN_PASS** (Doppler), kamilisha ndani ya dakika 3.

ClickPesa / PAY-OPS bado imeahirishwa.

## Residuals

- Auth0 region is **US** (not EU) — document as residency residual until EU tenant recreate.
- Web Universal Login UI not built.
- Production GO still NO GO.
