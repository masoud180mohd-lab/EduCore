# Manual multi-tenant QA — Identity & Tenant product reads (AUDIT-R4)

Local, step-by-step verification of **P5–P13** product GET routes after `seed:admin`.  
Audience: any engineer with Postgres roles from DEV-001 / Docker.

**Related**

- `docs/engineering/task-records/AUDIT-R4-read-increments-review.md`
- `docs/engineering/task-records/IMP-001-P10-live-read-isolation.md`
- `tasks/manual-test-p4b-rbac.md` (session bind foundation)

**Scope:** read-only HTTP surface. Do **not** expect write routes to succeed.

---

## Important limits (read before testing)

| Fact | Implication |
| ---- | ----------- |
| Seed creates **one** tenant + owner | Cross-tenant tests need a second tenant (Test 8 SQL) or rely on random UUIDs → 404 |
| `GET /tenants` is picker-only | No `X-Tenant-Id`, no `page` envelope; soft-capped at 100 |
| Orgs / settings may be empty | Seed does not create organizations or tenant_settings — empty list / 404 is OK |
| Live automated suite | Prefer `RUN_LIVE_DB_TESTS=1` + `tests/isolation/product-reads.live.test.ts` for CI-adjacent proof |

Default seed IDs:

| Entity | UUID |
| ------ | ---- |
| Tenant | `01900000-0010-7000-8000-000000000001` |
| User   | `01900000-0010-7000-8000-000000000002` |

Email: `admin@educore.local` · role: **owner**.

---

## 1. Preparation

### 1.1 Prerequisites

- PostgreSQL reachable (Docker **or** local Postgres 16+).
- Repo root, Node ≥ 20, `npm ci` / `npm install` done.

### 1.2 Database

```powershell
cd C:\Users\PM\school_management_system
# Docker optional: npm run docker:up
npm run db:migrate
npm run db:bootstrap-roles
```

### 1.3 Seed admin

```powershell
$env:SEED_ADMIN_PASS = 'ChangeMe-Local-Only-1'
# $env:SEED_ADMIN_RESET = '1'   # if re-seeding
npm run seed:admin
```

### 1.4 Nest runtime env (app pool)

```powershell
$env:NODE_ENV = 'development'
$env:PORT = '3000'
$env:EDUCORE_ENABLE_APP_DB = '1'
$env:EDUCORE_APP_DATABASE_URL = 'postgresql://educore_app:educore_app_local_only@127.0.0.1:5432/educore'
```

### 1.5 Start API

```powershell
npm run start:dev
```

Wait until the API listens on port **3000**. Use a **second** PowerShell for HTTP.

### 1.6 Automated gates (recommended)

```powershell
npm run check

# Focused product-read assurance
npx vitest run tests/integration/product-reads-authz.http.test.ts tests/tooling/p10-openapi-read-sync.test.ts tests/tooling/p6-p9-product-reads.test.ts

# Optional live (Postgres required)
$env:RUN_LIVE_DB_TESTS = '1'
$env:SEED_ADMIN_PASS = 'ChangeMe-Local-Only-1'
$env:EDUCORE_ENABLE_APP_DB = '1'
npx vitest run tests/isolation/product-reads.live.test.ts
```

---

## 2. Shared helpers

```powershell
$base = 'http://127.0.0.1:3000'
$tenant = '01900000-0010-7000-8000-000000000001'
$wrongTenant = '01900000-0000-7000-8000-000000009999'

function Invoke-Api {
  param(
    [string]$Method = 'GET',
    [string]$Path,
    [hashtable]$Headers = @{},
    [object]$Body = $null
  )
  $uri = "$base$Path"
  $params = @{
    Uri             = $uri
    Method          = $Method
    Headers         = $Headers
    SkipHttpErrorCheck = $true
  }
  if ($null -ne $Body) {
    $params.ContentType = 'application/json'
    $params.Body = ($Body | ConvertTo-Json -Depth 6)
  }
  $resp = Invoke-WebRequest @params
  [pscustomobject]@{
    Status = [int]$resp.StatusCode
    Json   = if ($resp.Content) { $resp.Content | ConvertFrom-Json } else { $null }
    Raw    = $resp.Content
  }
}
```

---

## 3. Test cases

### Test 1 — Login

```powershell
$login = Invoke-Api -Method POST -Path '/api/v1/auth/login' -Body @{
  email    = 'admin@educore.local'
  password = 'ChangeMe-Local-Only-1'
  tenantId = $tenant
}
$login.Status   # expect 200
$access = $login.Json.data.accessToken
$auth = @{ Authorization = "Bearer $access" }
$bound = @{
  Authorization = "Bearer $access"
  'X-Tenant-Id' = $tenant
}
```

| Check | Expected |
| ----- | -------- |
| Status | `200` |
| `accessToken` | non-empty |
| `tenantId` | seed tenant |

---

### Test 2 — Session / header mismatch (403)

```powershell
$mismatch = Invoke-Api -Path '/api/v1/organizations' -Headers @{
  Authorization = "Bearer $access"
  'X-Tenant-Id' = $wrongTenant
}
$mismatch.Status
$mismatch.Json.error.code
$mismatch.Json.error.details.reason
```

| Check | Expected |
| ----- | -------- |
| Status | `403` |
| `error.code` | `FORBIDDEN` |
| `details.reason` | `SESSION_TENANT_MISMATCH` |

Repeat quickly on `/api/v1/users`, `/api/v1/memberships`, `/api/v1/tenant-settings` — same 403/reason.

---

### Test 3 — Missing auth / missing tenant header

```powershell
(Invoke-Api -Path '/api/v1/organizations').Status                    # 401
(Invoke-Api -Path '/api/v1/organizations' -Headers $auth).Status     # 400 TENANT_CONTEXT_REQUIRED
(Invoke-Api -Path '/api/v1/tenants').Status                          # 401
```

| Route | No Bearer | Bearer, no `X-Tenant-Id` |
| ----- | --------- | ------------------------ |
| `GET /organizations` | 401 | 400 |
| `GET /tenants` (picker) | 401 | **200** (header not required) |

---

### Test 4 — Tenants picker + bound detail

```powershell
$list = Invoke-Api -Path '/api/v1/tenants' -Headers $auth
$list.Status
$list.Json.data | Format-Table id, code, name, status
# expect: no .page property; at least seed tenant

$current = Invoke-Api -Path '/api/v1/tenants/current' -Headers $bound
$current.Status   # 200
$current.Json.data.id

$byId = Invoke-Api -Path "/api/v1/tenants/$tenant" -Headers $bound
$byId.Status      # 200

$pathMismatch = Invoke-Api -Path "/api/v1/tenants/$wrongTenant" -Headers $bound
$pathMismatch.Status
$pathMismatch.Json.error.details.reason   # TENANT_PATH_MISMATCH → 403
```

| Check | Expected |
| ----- | -------- |
| List envelope | `{ data: [...] }` — **no** `page` |
| List includes seed | yes |
| `current` / `:id` | 200 when bound |
| Path ≠ header | 403 `TENANT_PATH_MISMATCH` |

---

### Test 5 — Organizations list + detail

```powershell
$orgs = Invoke-Api -Path '/api/v1/organizations?limit=10' -Headers $bound
$orgs.Status
$orgs.Json.page.limit          # 10
$orgs.Json.page.nextCursor     # null if empty/short page

# Invalid cursor → 400
$badCursor = Invoke-Api -Path '/api/v1/organizations?cursor=not-a-uuid' -Headers $bound
$badCursor.Status              # 400
$badCursor.Json.error.code     # VALIDATION_ERROR

# Cross-tenant / unknown id → 404 (no leak)
$fakeOrg = '01900000-0000-7000-8000-00000000dead'
$org404 = Invoke-Api -Path "/api/v1/organizations/$fakeOrg" -Headers $bound
$org404.Status                 # 404
```

| Check | Expected |
| ----- | -------- |
| List | 200 + `{ data, page }` |
| Bad cursor | 400 |
| Unknown id | 404 |

Optional filters (after you insert an org — Test 8): `?status=active&orgType=school&search=demo`.

---

### Test 6 — Memberships + users

```powershell
$mems = Invoke-Api -Path '/api/v1/memberships?limit=25' -Headers $bound
$mems.Status
$mems.Json.data.Count          # ≥ 1 (seed owner membership)
$memId = $mems.Json.data[0].id

$memOne = Invoke-Api -Path "/api/v1/memberships/$memId" -Headers $bound
$memOne.Status                 # 200

$users = Invoke-Api -Path '/api/v1/users?limit=25' -Headers $bound
$users.Status
$users.Json.data | Format-Table id, email, displayName, status

$userId = $users.Json.data[0].id
$userOne = Invoke-Api -Path "/api/v1/users/$userId" -Headers $bound
$userOne.Status                # 200

# Invited filter (may be empty)
$invited = Invoke-Api -Path '/api/v1/users?status=invited' -Headers $bound
$invited.Status                # 200

# Unknown user → 404
$user404 = Invoke-Api -Path '/api/v1/users/01900000-0000-7000-8000-00000000dead' -Headers $bound
$user404.Status                # 404
```

| Check | Expected |
| ----- | -------- |
| Memberships list | includes seed membership |
| Users list | includes seed admin (active membership) |
| `GET /users/{id}` | 200 for seed user |
| Unknown ids | 404 |

---

### Test 7 — Tenant settings

```powershell
$settings = Invoke-Api -Path '/api/v1/tenant-settings' -Headers $bound
$settings.Status
# 200 if a settings row exists; 404 if seed never created one — both OK
# Must NOT return another tenant's document
```

| Check | Expected |
| ----- | -------- |
| Status | `200` or `404` |
| On mismatch header | `403` (Test 2) |

---

### Test 8 — Second tenant isolation (optional, SQL)

Creates a foreign org under a second tenant; bound session must get **404** for that org id.

```powershell
# Requires psql or any client as educore_platform with trusted GUCs.
# Example using docker/psql — adapt connection string:
$env:PGPASSWORD = 'educore_platform_local_only'
# Run the SQL below via psql / pgAdmin / Nest is NOT used for inserts (writes closed).
```

```sql
BEGIN;
SELECT set_config('app.is_platform_operator', 'true', true);
SELECT set_config('app.rls_mode', 'bootstrap', true);

INSERT INTO tenants (id, code, name, status)
VALUES ('01900000-00bb-7000-8000-0000000000bb', 'qa-other', 'QA Other', 'active')
ON CONFLICT DO NOTHING;

INSERT INTO organizations (id, tenant_id, org_type, name, status)
VALUES (
  '01900000-00bb-7000-8000-0000000000o1',
  '01900000-00bb-7000-8000-0000000000bb',
  'school',
  'Foreign School',
  'active'
)
ON CONFLICT DO NOTHING;

COMMIT;
```

Then:

```powershell
$foreign = Invoke-Api -Path '/api/v1/organizations/01900000-00bb-7000-8000-0000000000o1' -Headers $bound
$foreign.Status   # 404 — not 200, not 403 with existence leak
```

Cleanup (platform session):

```sql
BEGIN;
SELECT set_config('app.is_platform_operator', 'true', true);
SELECT set_config('app.rls_mode', 'bootstrap', true);
DELETE FROM organizations WHERE id = '01900000-00bb-7000-8000-0000000000o1';
DELETE FROM tenants WHERE id = '01900000-00bb-7000-8000-0000000000bb';
COMMIT;
```

---

### Test 9 — Writes still closed

```powershell
$postOrg = Invoke-Api -Method POST -Path '/api/v1/organizations' -Headers $bound -Body @{
  name = 'Should Fail'
  orgType = 'school'
}
$postOrg.Status   # 404 or 405 — never 201
```

---

## 4. Results checklist

Copy and fill after a run:

| # | Test | Pass? | Notes |
| - | ---- | ----- | ----- |
| 1 | Login | ☐ | |
| 2 | Session/header mismatch → 403 | ☐ | |
| 3 | 401 / 400 / tenants picker without header | ☐ | |
| 4 | Tenants list / current / path mismatch | ☐ | |
| 5 | Orgs list, bad cursor, 404 | ☐ | |
| 6 | Memberships + users list/detail | ☐ | |
| 7 | Tenant settings 200/404 | ☐ | |
| 8 | Foreign org 404 (optional) | ☐ | |
| 9 | POST organizations closed | ☐ | |
| A | `npm run check` | ☐ | |
| B | Live `product-reads.live.test.ts` (optional) | ☐ | |

**Operator:** _________________ **Date:** _________________

---

## 5. Honesty

- Solo-operator freeze ≠ independent peer review.
- Passing this checklist is **manual QA evidence**, not freeze re-acceptance and not permission to open write routes.
- Prefer recording failures with status + `error.code` + `details.reason` for triage.
