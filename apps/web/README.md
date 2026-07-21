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

(API listens on 3000 by default; web on 3001.)

## Auth note

Bearer token + `X-Tenant-Id` stored in `sessionStorage` (see DSF-001 threat note).
