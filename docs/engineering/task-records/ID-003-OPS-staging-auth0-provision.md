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

## Owner follow-ups (optional smoke)

1. Create Auth0 user with email **`admin@educore.staging`** (matches seed) so first-link works.
2. Obtain Auth0 ID token (Auth0 dashboard test / PKCE), then:

```http
POST /api/v1/auth/login
{ "idpAssertion": "<id_token>", "tenantId": "<staging-tenant-uuid>" }
```

Password login remains enabled.

## Residuals

- Auth0 region is **US** (not EU) — document as residency residual until EU tenant recreate.
- Web Universal Login UI not built.
- Production GO still NO GO.
