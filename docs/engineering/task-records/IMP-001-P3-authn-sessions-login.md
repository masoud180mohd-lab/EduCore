# IMP-001 Phase P3 — AuthN Sessions & Login Flow

## Outcome

Under **ADR-012 conditional freeze**, implement database-backed sessions, real opaque-token `TokenValidator`, and gated auth endpoints: `POST /api/v1/auth/login`, `refresh`, `logout`. Integrate with `tenant_memberships` (session requires active membership) and audit publisher. **No tenant/user CRUD routes.**

## Status

**Complete** (P3 foundation; MFA / me / select-tenant deferred).

## Deliverables

### Database

| Migration                 | Purpose                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------- |
| `20260715020000_sessions` | `sessions` table (DBF-001 + refresh hash), FORCE RLS, SECURITY DEFINER auth helpers |

**Helpers (educore_app EXECUTE):**

- `app.auth_lookup_user_by_email`
- `app.auth_list_active_membership_tenants` / `auth_has_active_membership`
- `app.auth_create_session` (membership check + last_login_at)
- `app.auth_find_session_by_access_hash` / `refresh_hash`
- `app.auth_rotate_session_tokens` / `auth_revoke_session` / `auth_touch_session`

### Nest AuthN

| Component             | Location                                                   |
| --------------------- | ---------------------------------------------------------- |
| Session repository    | `identity-and-access/repositories/session.repository.ts`   |
| Password hasher       | scrypt (`password-hasher.ts`)                              |
| Opaque tokens         | `common/auth/opaque-tokens.ts` (access 15m, refresh 7d)    |
| AuthService           | login / refresh / logout                                   |
| AuthController        | `/api/v1/auth/*` only                                      |
| SessionTokenValidator | Identity module wires TOKEN_VALIDATOR (repo stays private) |
| Login rate limiter    | in-process 10 / 15 min per email+IP                        |

### TokenValidator behaviour

| Pool / sessions store | Validator                 |
| --------------------- | ------------------------- |
| Disabled (CI default) | `RejectAllTokenValidator` |
| Enabled               | `SessionTokenValidator`   |

## Security notes

- Passwords: scrypt; never returned or logged.
- Tokens: opaque random; only SHA-256 hashes stored.
- Login failures always `INVALID_CREDENTIALS` (no user enumeration).
- Session creation requires **active** `tenant_memberships` row (SECURITY DEFINER).
- Refresh re-checks membership; rotation conflict revokes session (reuse foundation).
- Rate limit on login failures; audit events redacted via platform publisher.
- RLS on `sessions` FORCE; inserts only via definer functions.
- No JWT algorithm confusion surface.

## Explicit non-goals

- MFA verify, `/auth/me`, select-tenant, session list/admin revoke
- OIDC / IdP assertion path (validation rejects with clear message)
- Tenant/user management HTTP APIs
- Redis-backed rate limit / refresh cookie path

## Verification

```bash
# privileged migrate for DDL
$env:DATABASE_URL='postgresql://postgres:educore_local_only@127.0.0.1:5432/educore'
npm run db:migrate

npm run check
npm run boundaries:check
```

## Recommended next step

1. ~~Seed local admin~~ → **`npm run seed:admin`** (`IMP-001-P3-seed-local-admin.md`).
2. Optional: `GET /auth/me` + select-tenant (T23).
3. MFA challenge path (T21) when product requires it.
4. Keep conditional freeze until DBF/ACF human signatures.
