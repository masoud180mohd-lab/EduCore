# Database seeds (local / lab only)

## Initial admin user

**Do not use auto-applied SQL migrations for passwords.** EduCore login verifies **scrypt** hashes produced by Nest (`password-hasher.ts`). SQL cannot generate those hashes portably.

### Preferred command

From repository root (after `db:migrate` + `db:bootstrap-roles`):

```powershell
$env:SEED_ADMIN_PASS = 'ChangeMe-Local-Only-1'
npm run seed:admin
```

This connects as **`educore_platform`** with trusted bootstrap GUCs, creates:

| Entity     | Fixed local UUID (default)             |
| ---------- | -------------------------------------- |
| Tenant     | `01900000-0010-7000-8000-000000000001` |
| User       | `01900000-0010-7000-8000-000000000002` |
| Membership | `01900000-0010-7000-8000-000000000003` |

### Optional environment

| Variable                        | Default                                                  |
| ------------------------------- | -------------------------------------------------------- |
| `SEED_ADMIN_PASS`               | **required** (min 8 chars; alias `SEED_ADMIN_PASSWORD`)  |
| `SEED_ADMIN_EMAIL`              | `admin@educore.local`                                    |
| `SEED_TENANT_CODE`              | `demo-school`                                            |
| `SEED_TENANT_NAME`              | `Demo School`                                            |
| `SEED_PLATFORM_DATABASE_URL`    | `postgresql://educore_platform:…@127.0.0.1:5432/educore` |
| `SEED_ADMIN_RESET=1`            | Update password if user already exists                   |
| `SEED_ADMIN_ALLOW_PRODUCTION=1` | Required if `NODE_ENV=production` (break-glass only)     |

### Login smoke

```powershell
$env:EDUCORE_APP_DATABASE_URL = 'postgresql://educore_app:educore_app_local_only@127.0.0.1:5432/educore'
$env:EDUCORE_ENABLE_APP_DB = '1'
# start API, then:
# POST /api/v1/auth/login  { "email": "admin@educore.local", "password": "…", "tenantId": "01900000-0010-7000-8000-000000000001" }
```

Full P4b manual plan (session bind + reconcile + auth flow): `tasks/manual-test-p4b-rbac.md`.

### Security

- **Local / lab only.** Refuse production unless explicitly allowed.
- Never commit real passwords.
- Seed uses **platform** role — never configure Nest runtime as platform/superuser.
- No public HTTP seed endpoint (conditional freeze).

See also: `docs/engineering/task-records/IMP-001-P3-seed-local-admin.md`.
