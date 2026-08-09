# WEB-AUTH0 — Auth0 Universal Login (PKCE) on web

| Field     | Value                                           |
| --------- | ----------------------------------------------- |
| Program   | **WEB-AUTH0** (optional UI after ID-003-OPS)    |
| Date      | 2026-08-09                                      |
| Status    | **Done** (solo-operator provisional)            |
| Depends   | ID-003 · ID-003-OPS SMOKE_PASS · `GO WEB-AUTH0` |
| Authority | Solo-operator provisional (SOLO-GOV-001)        |

## Delivered

- Login button **“Ingia na Auth0”** when `NEXT_PUBLIC_AUTH0_DOMAIN` + `NEXT_PUBLIC_AUTH0_CLIENT_ID` set
- Authorization Code + PKCE → `/auth/callback` → `POST /api/v1/auth/login` with `idpAssertion: { code, redirectUri, codeVerifier }`
- EduCore opaque session only (Auth0 tokens never become API bearers)
- Password login remains available
- API: `parseIdpAssertion` accepts JSON **object** (not only stringified JSON)
- Unit tests for PKCE helpers + object assertion parse

## Env (web `.env.local`)

```
NEXT_PUBLIC_AUTH0_DOMAIN=dev-ght4bps24glm825x.us.auth0.com
NEXT_PUBLIC_AUTH0_CLIENT_ID=<same client id as API / Doppler>
# optional:
# NEXT_PUBLIC_AUTH0_AUDIENCE=
```

Auth0 app callbacks must include `http://localhost:3001/auth/callback` (already on staging app per OPS).

## Ops honesty

- Button hidden when public Auth0 env unset (local password-only lab)
- API still requires `AUTH_IDP_PROVIDER=auth0` + server secrets for exchange
- Password AuthN not cut over
- Production GO still NO GO

## Manual check

1. Set web public Auth0 env; run `npm run dev:web`
2. Open `/login` → see **Ingia na Auth0**
3. Complete Auth0 Universal Login → land in EduCore with opaque session
4. Without public env → button absent; password still works
