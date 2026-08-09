# Teacher web app (IMP-006)

Provisional Next.js App Router UI for **online** teacher attendance against Nest `ACF-009`.

## Run

```bash
# API (separate terminal)
npm run start:dev

# Web (:3001)
npm run dev:web
```

Open http://localhost:3001/login

## Env

Copy `.env.example` → `.env.local`:

```
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3000
```

Optional Auth0 Universal Login (WEB-AUTH0):

```
NEXT_PUBLIC_AUTH0_DOMAIN=your-tenant.us.auth0.com
NEXT_PUBLIC_AUTH0_CLIENT_ID=...
```

(API listens on 3000 by default; web on 3001. Callback: `/auth/callback`.)

## Auth note

Bearer token + `X-Tenant-Id` stored in `sessionStorage` (see DSF-001 threat note).
When Auth0 is configured, **Ingia na Auth0** uses PKCE; EduCore still mints opaque `ecs_` sessions via the API.
