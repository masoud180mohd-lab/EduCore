# Manual test plan — IMP-001 P4b (session bind + grant reconcile)

Local, step-by-step verification of **P4b** after `seed:admin`.  
Audience: any engineer with Postgres roles from DEV-001 / Docker.

**Related:** `docs/engineering/task-records/IMP-001-P4b-rbac-session-bind-grant-reconcile.md`

---

## Important limits (read before testing)

| Fact                                                                                                   | Implication for this plan                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `RequirePermission` / `RequireActiveMembershipGuard` are **not** wired on any HTTP route yet (ADR-012) | **Test 3 (session mismatch → 403) cannot be exercised via curl against `/auth/me`.** That endpoint uses `RequireAuthGuard` only and resolves RBAC from **session** `tenantId`. |
| Session bind **is** covered by unit tests                                                              | Use Test 3A (automated) as the acceptance proof today.                                                                                                                         |
| Grant reconcile is an **ops script**, not an HTTP API                                                  | Use Test 6 (optional) for that High fix.                                                                                                                                       |

Default seed IDs (unless you overrode seed env):

| Entity | UUID                                   |
| ------ | -------------------------------------- |
| Tenant | `01900000-0010-7000-8000-000000000001` |
| User   | `01900000-0010-7000-8000-000000000002` |

Default email: `admin@educore.local` · assigned system role: **owner** (full `PERMISSION_CODES`).

---

## 1. Preparation

### 1.1 Prerequisites

- PostgreSQL reachable (Docker Desktop **or** local Postgres 16+).
- From repo root: Node ≥ 20, dependencies installed (`npm ci` or `npm install`).

### 1.2 Start database (choose one)

**Docker (preferred if installed):**

```powershell
cd C:\Users\PM\school_management_system
npm run docker:up
```

**Local Postgres:** ensure DB `educore` exists and roles were bootstrapped previously.

### 1.3 Migrate + bootstrap roles

```powershell
# Privileged / local migrate URL (DEV-001 defaults often work without setting DATABASE_URL)
npm run db:migrate
npm run db:bootstrap-roles
```

**If it fails:** Postgres not up, wrong `DATABASE_URL`, or roles missing. Fix connectivity first; do not continue to seed.

### 1.4 Seed local admin (+ system roles)

```powershell
$env:SEED_ADMIN_PASS = 'ChangeMe-Local-Only-1'
# optional reset if user already exists:
# $env:SEED_ADMIN_RESET = '1'
npm run seed:admin
```

**Expected stdout includes:** `rbac.assignedRole: owner`, `tenantId: 01900000-0010-7000-8000-000000000001`.

**If it fails:** often missing `educore_platform` password / URL. Set:

```powershell
$env:SEED_PLATFORM_DATABASE_URL = 'postgresql://educore_platform:educore_platform_local_only@127.0.0.1:5432/educore'
```

### 1.5 Nest runtime env (app pool — never platform/migrator)

In the **same** shell you will use to start the API:

```powershell
$env:NODE_ENV = 'development'
$env:PORT = '3000'
$env:EDUCORE_ENABLE_APP_DB = '1'
$env:EDUCORE_APP_DATABASE_URL = 'postgresql://educore_app:educore_app_local_only@127.0.0.1:5432/educore'
# Default: refreshToken still appears in JSON body (API clients). Cookie is always set.
# Cookie-only JSON body: $env:EDUCORE_REFRESH_IN_BODY = '0'
```

### 1.6 Start API

```powershell
npm run start:dev --workspace=@educore/api
```

Wait for log: `EduCore API skeleton listening` on port **3000** (or your `PORT`).

Keep this terminal open. Use a **second** PowerShell window for HTTP tests.

### 1.7 Baseline automated gate (optional but recommended)

```powershell
npm run check
# focused bind + reconcile coverage:
npx vitest run apps/api/src/common/auth/session-tenant-bind.test.ts apps/api/src/common/auth/require-active-membership.guard.test.ts apps/api/src/common/policy/require-permission.guard.test.ts apps/api/src/modules/identity-and-access/rbac/system-role-grant-reconcile.test.ts tests/tooling/p4-rbac-foundation.test.ts
```

---

## 2. Test cases

All HTTP examples use PowerShell `Invoke-RestMethod` / `Invoke-WebRequest`.  
Base URL: `http://127.0.0.1:3000`.

### Test 1 — Login (admin)

**Steps**

```powershell
$base = 'http://127.0.0.1:3000'
$loginBody = @{
  email    = 'admin@educore.local'
  password = 'ChangeMe-Local-Only-1'
  tenantId = '01900000-0010-7000-8000-000000000001'
} | ConvertTo-Json

$loginResp = Invoke-WebRequest -Uri "$base/api/v1/auth/login" `
  -Method POST -ContentType 'application/json' -Body $loginBody -SessionVariable sess

$login = ($loginResp.Content | ConvertFrom-Json).data
$login.accessToken
$login.refreshToken   # present unless EDUCORE_REFRESH_IN_BODY=0
$login.tenantId
$loginResp.Headers['Set-Cookie']
```

**Expected**

| Check               | Expected                                                           |
| ------------------- | ------------------------------------------------------------------ |
| HTTP status         | `200`                                                              |
| `data.accessToken`  | non-empty opaque string                                            |
| `data.refreshToken` | non-empty **unless** `EDUCORE_REFRESH_IN_BODY=0`                   |
| `data.tenantId`     | seed tenant UUID                                                   |
| `Set-Cookie`        | contains `ecr_refresh=…` with `HttpOnly` (and path `/api/v1/auth`) |

Save for later:

```powershell
$access = $login.accessToken
$refresh = $login.refreshToken
$tenant = $login.tenantId
```

**If it fails**

| Symptom                           | Likely cause                  | Fix                                                        |
| --------------------------------- | ----------------------------- | ---------------------------------------------------------- |
| Connection refused                | API not running               | Start `start:dev` with app DB env                          |
| `503` / internal auth unavailable | App pool not enabled          | Set `EDUCORE_ENABLE_APP_DB=1` + `EDUCORE_APP_DATABASE_URL` |
| `INVALID_CREDENTIALS`             | Wrong password / seed not run | Re-run `seed:admin` with `SEED_ADMIN_RESET=1`              |
| `TENANT_MEMBERSHIP_REQUIRED`      | Wrong `tenantId`              | Use seeded tenant UUID from seed stdout                    |

---

### Test 2 — `GET /auth/me` (roles + permissions)

**Steps**

```powershell
$meResp = Invoke-RestMethod -Uri "$base/api/v1/auth/me" -Headers @{
  Authorization = "Bearer $access"
}
$meResp.data | ConvertTo-Json -Depth 6
$meResp.data.roles
$meResp.data.permissions
$meResp.data.activeTenantId
```

**Expected**

| Check                 | Expected                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------- |
| HTTP                  | `200`                                                                                     |
| `data.activeTenantId` | seed tenant                                                                               |
| `data.roles`          | includes `{ code: "owner", …, isSystem: true }`                                           |
| `data.permissions`    | **13** codes (owner = full catalogue), including `entitlement.manage` and `tenant.manage` |
| Sorted permissions    | alphabetical list of all DBF-001 codes                                                    |

Owner catalogue (all must appear):

`audit.read`, `entitlement.manage`, `entitlement.read`, `organization.manage`, `organization.read`, `role.manage`, `role.read`, `session.revoke`, `tenant.manage`, `tenant.read`, `user.invite`, `user.manage`, `user.read`

**If it fails**

| Symptom                       | Likely cause                   | Fix                                                 |
| ----------------------------- | ------------------------------ | --------------------------------------------------- |
| `roles` / `permissions` empty | App DB off, or session unbound | Confirm env + login with `tenantId`; re-seed RBAC   |
| `401`                         | Bad / expired access token     | Re-login                                            |
| Missing `entitlement.manage`  | Not owner / matrix drift       | Check seed assigned `owner`; run reconcile (Test 6) |

---

### Test 3 — Session tenant binding

#### Test 3A — Automated (required today)

```powershell
npx vitest run apps/api/src/common/auth/session-tenant-bind.test.ts apps/api/src/common/auth/require-active-membership.guard.test.ts apps/api/src/common/policy/require-permission.guard.test.ts
```

**Expected:** all pass; mismatch cases assert `code: 'FORBIDDEN'`, `details.reason: 'SESSION_TENANT_MISMATCH'`, `statusCode: 403`.

#### Test 3B — HTTP observation (informational — not a failure if 200)

`/auth/me` does **not** apply session↔header bind. Confirm current behavior:

```powershell
$otherTenant = '00000000-0000-4000-8000-000000000099'
Invoke-RestMethod -Uri "$base/api/v1/auth/me" -Headers @{
  Authorization = "Bearer $access"
  'X-Tenant-Id' = $otherTenant
} | ConvertTo-Json -Depth 5
```

**Expected today:** still **200**; `activeTenantId` remains **session** tenant (not the spoofed header).  
**Not expected today:** `403 SESSION_TENANT_MISMATCH` on `/auth/me`.

When the first privileged route is wired with `RequirePermission` / `RequireActiveMembershipGuard`, repeat with that route and expect:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "details": { "reason": "SESSION_TENANT_MISMATCH" }
  }
}
```

**If 3A fails:** P4b bind regression — fix before shipping routes.

---

### Test 4 — Refresh token rotation

**Steps (body fallback — easiest in PowerShell):**

```powershell
$refreshBody = @{ refreshToken = $refresh } | ConvertTo-Json
$refreshResp = Invoke-WebRequest -Uri "$base/api/v1/auth/refresh" `
  -Method POST -ContentType 'application/json' -Body $refreshBody -WebSession $sess

$ref = ($refreshResp.Content | ConvertFrom-Json).data
$ref.accessToken
$ref.refreshToken
$refreshResp.Headers['Set-Cookie']
```

**Cookie path (after login captured `$sess`):**

```powershell
Invoke-WebRequest -Uri "$base/api/v1/auth/refresh" `
  -Method POST -ContentType 'application/json' -Body '{}' -WebSession $sess
```

**Expected**

| Check              | Expected                                            |
| ------------------ | --------------------------------------------------- |
| HTTP               | `200`                                               |
| New `accessToken`  | different from previous (usually)                   |
| New `refreshToken` | rotated (old refresh should stop working after use) |
| `Set-Cookie`       | new `ecr_refresh`                                   |

Prove old refresh is dead (optional):

```powershell
try {
  Invoke-RestMethod -Uri "$base/api/v1/auth/refresh" -Method POST `
    -ContentType 'application/json' -Body (@{ refreshToken = $refresh } | ConvertTo-Json)
} catch {
  $_.Exception.Response.StatusCode.value__
}
```

**If it fails:** cookie path wrong (must hit `/api/v1/auth/*`); secure cookie on HTTP (`EDUCORE_COOKIE_SECURE=1` on localhost) — set `EDUCORE_COOKIE_SECURE=0` for lab HTTP.

---

### Test 5 — Logout

**Steps**

```powershell
$access2 = $ref.accessToken   # use latest access from Test 4
$logout = Invoke-WebRequest -Uri "$base/api/v1/auth/logout" `
  -Method POST -Headers @{ Authorization = "Bearer $access2" } `
  -WebSession $sess

$logout.StatusCode
$logout.Headers['Set-Cookie']

# access should no longer work
try {
  Invoke-RestMethod -Uri "$base/api/v1/auth/me" -Headers @{ Authorization = "Bearer $access2" }
} catch {
  $_.Exception.Response.StatusCode.value__
}
```

**Expected**

| Check                             | Expected                                    |
| --------------------------------- | ------------------------------------------- |
| Logout HTTP                       | `204`                                       |
| Cookie                            | `ecr_refresh` cleared (`Max-Age=0` / empty) |
| Subsequent `/me` with same access | `401`                                       |

**If it fails:** missing `Authorization` → may still clear cookie but session revoke needs auth; use bearer from last refresh.

---

### Test 6 — Grant reconcile (optional; P4b second High)

Ops path only — uses privileged `DATABASE_URL` (migrator/superuser), **not** Nest app URL.

```powershell
# same DATABASE_URL style as db:migrate
npm run rbac:reconcile-grants -- --tenant-id=01900000-0010-7000-8000-000000000001
```

**Expected:** JSON lines per role (`owner`/`admin`/`staff`) with `removed` / `added` arrays (often empty if matrices already match); final `Reconciled 1 tenant(s).`

**If it fails with permission denied on DELETE:** you pointed at `educore_app` — switch to migrator/superuser `DATABASE_URL`.

---

## 3. Expected results summary

| #    | Result when green                                    |
| ---- | ---------------------------------------------------- |
| Prep | migrate + bootstrap + seed + API up with app pool    |
| 1    | Login 200; access + refresh; `ecr_refresh` HttpOnly  |
| 2    | `/me` shows owner + 13 permissions                   |
| 3A   | Bind unit tests pass (403 mismatch)                  |
| 3B   | `/me` with wrong header still 200 (documented limit) |
| 4    | Refresh rotates tokens                               |
| 5    | Logout 204; access revoked                           |
| 6    | Reconcile script completes under privileged DB URL   |

### Stop / escalate

1. Fix DB/roles/env first (most “auth broken” issues).
2. Re-run focused vitest for P4b.
3. Do not open business routes to “make Test 3 HTTP pass” — that is a separate ADR-012 decision.

---

## 4. Checklist (copy/paste)

```text
[ ] db:migrate + db:bootstrap-roles
[ ] seed:admin (owner assigned)
[ ] EDUCORE_ENABLE_APP_DB=1 + EDUCORE_APP_DATABASE_URL
[ ] API start:dev listening
[ ] Test 1 login + cookie
[ ] Test 2 /me roles+permissions
[ ] Test 3A vitest bind
[ ] Test 3B noted (no 403 on /me)
[ ] Test 4 refresh
[ ] Test 5 logout
[ ] Test 6 reconcile (optional)
```
