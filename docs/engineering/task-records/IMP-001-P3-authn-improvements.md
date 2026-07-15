# IMP-001 P3 Improvement — /auth/me, select-tenant, HttpOnly refresh, rate limit

## Outcome

Harden Phase P3 AuthN without opening tenant/user CRUD routes:

1. `GET /api/v1/auth/me` + `POST /api/v1/auth/select-tenant`
2. HttpOnly refresh cookie (`ecr_refresh`) with body fallback
3. Multi-backend login rate limiting: **Redis → Postgres → in-memory**

## Status

**Complete** (under ADR-012 conditional freeze).

## What improved

| Area           | Change                                                                    |
| -------------- | ------------------------------------------------------------------------- |
| Me             | Returns user profile, membership summaries, `activeTenantId`, `sessionId` |
| Select-tenant  | Rebinds `sessions.tenant_id` when active membership; audit event          |
| Refresh cookie | Set on login/refresh; cleared on logout; path `/api/v1/auth`              |
| Body refresh   | Still accepted; still returned unless `EDUCORE_REFRESH_IN_BODY=0`         |
| Rate limit     | `createLoginRateLimiter`: Redis URL → `app.login_rate_limits` → memory    |
| DB             | Migration `20260715030000_auth_me_select_rate`                            |

## Environment

| Variable                          | Purpose                                             |
| --------------------------------- | --------------------------------------------------- |
| `EDUCORE_REDIS_URL` / `REDIS_URL` | Prefer Redis rate limit (`redis://:pass@host:6379`) |
| `EDUCORE_LOGIN_RATE_MAX`          | Max failures per window (default 10)                |
| `EDUCORE_LOGIN_RATE_WINDOW_MS`    | Window ms (default 900000)                          |
| `EDUCORE_REFRESH_IN_BODY=0`       | Cookie-only refresh in JSON responses               |
| `EDUCORE_COOKIE_SECURE=1\|0`      | Force Secure flag (else production default)         |

## What stayed deferred

| Item                                  | Reason                                    |
| ------------------------------------- | ----------------------------------------- |
| Session list / admin revoke           | Separate ACF routes; not in this slice    |
| MFA                                   | Separate phase                            |
| CSRF double-submit for cookie refresh | SameSite=Lax + auth path; full CSRF later |
| Tenant/user CRUD HTTP                 | Conditional freeze NO-GO                  |

## Security notes

- Refresh cookie: `HttpOnly`, `SameSite=Lax`, path-scoped, Secure in production
- Select-tenant: active membership required (fail closed)
- Rate limit: multi-instance via Redis or Postgres; single-process memory fallback
- No password/token logging

## Verification

```bash
# privileged migrate for new helpers
$env:DATABASE_URL='postgresql://postgres:educore_local_only@127.0.0.1:5432/educore'
npm run db:migrate
npm run check
```

## Risks

| Risk                              | Mitigation                                 |
| --------------------------------- | ------------------------------------------ |
| Mini-Redis RESP incomplete        | Falls back to PG/memory on connect failure |
| Cookie not sent cross-site        | Path-limited; document BFF same-site       |
| select-tenant without tenant.read | Self-service membership intentional (ACF)  |
