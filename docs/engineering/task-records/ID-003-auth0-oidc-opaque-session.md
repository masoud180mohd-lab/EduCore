# ID-003 — Auth0 OIDC → opaque session task record

| Field     | Value |
| --------- | ----- |
| Program   | **GO IDP-003** |
| Date      | 2026-08-09 |
| Status    | **Done** (code integrated; Auth0 tenant + staging flag optional ops) |
| Decision  | `docs/engineering/decisions/ID-003-auth0-oidc-opaque-session.md` |
| Authority | Solo-operator provisional (SOLO-GOV-001) |

## Delivered

- `AUTH_IDP_PROVIDER` + Auth0 config loader (fail-closed)
- `Auth0IdpAssertionVerifier` (ID token JWKS verify; optional auth-code exchange)
- Migration `20260809150000_auth_idp_external_subject` (lookup + first-link helpers)
- `AuthService` assertion path → same opaque session + MFA finalize as password
- Unit tests; `.env.example` names; ADR + this record

## Ops checklist (Owner machine — not done in this commit)

1. Create Auth0 tenant (prefer **EU**).
2. Application: SPA or Regular Web; callback URLs for web origin; OIDC.
3. Doppler `stg`: `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID` (+ `AUTH0_CLIENT_SECRET` if confidential), then `AUTH_IDP_PROVIDER=auth0`.
4. `npm run db:migrate` against staging (FRA Neon).
5. Sync Fly secrets; create/link Auth0 user email = existing EduCore user; POST login with `idpAssertion` = ID token.
6. Leave password login enabled until a separate cutover decision.

## Explicitly not done

- Live Auth0 tenant creation
- Web Universal Login UI
- Password disabled / SSO-only cutover
- Production GO

## Next

Staging enable when Owner provisions Auth0; `GO PAY-OPS` when ClickPesa keys exist.
