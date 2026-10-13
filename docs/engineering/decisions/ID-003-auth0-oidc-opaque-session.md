# ID-003 — Auth0 OIDC → EduCore opaque session

| Field       | Value                                                     |
| ----------- | --------------------------------------------------------- |
| Decision ID | `ID-003`                                                  |
| Status      | **Accepted (solo-operator)** — 2026-08-09 (`GO IDP-003`)  |
| Date        | 2026-08-09                                                |
| Program     | Follow-on to **ID-002** (Auth0 selected)                  |
| Authority   | Solo-operator provisional (SOLO-GOV-001)                  |
| Governing   | ID-001 · ID-002 · ACF-001 login dual-ready · B-04 lite TM |

## Objective

Wire **Auth0** proof into `POST /api/v1/auth/login` via `idpAssertion`, then mint the same **EduCore opaque** access/refresh sessions as password login. Local password AuthN remains the default until an explicit cutover flag decision.

## Decision (Accepted)

| Field             | Value                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| Flag              | `AUTH_IDP_PROVIDER=local` (default) \| `auth0`                                                         |
| Secrets           | `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`; optional `AUTH0_CLIENT_SECRET`, `AUTH0_AUDIENCE` via Doppler        |
| Assertion payload | Auth0 **ID token** (JWT string) or JSON `{ "idToken" }` / `{ "code", "redirectUri", "codeVerifier?" }` |
| Session           | Always EduCore `ecs_` / `ecr_` opaque tokens — Auth0 tokens never become API bearers                   |
| User map          | `users.external_subject_id` = Auth0 `sub`; first-link by **verified** email when unset                 |
| Provisioning      | **No** auto-create users                                                                               |
| MFA               | EduCore TOTP / MFA-HARD still applies after IdP proof                                                  |
| Web SDK           | Out of this slice — client may obtain Auth0 ID token (PKCE) and POST it                                |

## Binding rules

1. Assertion path stays rejected unless `AUTH_IDP_PROVIDER=auth0` **and** domain/client id are set.
2. Do not disable password login in this decision.
3. Do not claim “SSO ready” for unrestricted/public multi-school without enrollment + DPA + cutover.
4. Prefer Auth0 **EU** tenant (ID-002); document US residual if billing forces it.
5. Never commit Auth0 secrets.

## Acceptance

- [x] Feature flag + fail-closed misconfig
- [x] Verify Auth0 ID token (JWKS RS256) / optional code exchange
- [x] Map/link `external_subject_id` helpers
- [x] Mint opaque EduCore session + MFA path shared with password
- [x] Unit tests; local AuthN unchanged by default

## Explicit non-goals

- Auth0 tenant provisioning on Owner account (ops checklist in task record)
- Web Auth0 Universal Login UI (**done in WEB-AUTH0** — see task record)
- Replacing MFA-001 TOTP with Auth0 MFA
- Production GO / password cutover

## Consequences

1. Staging may enable Auth0 after migrate + Doppler secrets.
2. Next ops: create EU Auth0 app, set secrets, migrate FRA Neon, smoke `idpAssertion`.
3. PAY-OPS still blocked on ClickPesa keys.
