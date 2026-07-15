# IMP-001 P3 Improvement — Local Admin Seed

## Outcome

Provide a **safe, documented** way to create the first tenant + admin user + active membership so developers can exercise `POST /api/v1/auth/login` without opening user/tenant CRUD HTTP routes.

## Status

**Complete** (local/lab tooling only).

## Chosen approach

| Option                           | Chosen? | Reason                                               |
| -------------------------------- | ------- | ---------------------------------------------------- |
| Node seed command (scrypt)       | **Yes** | Matches Nest password hash format; idempotent        |
| SQL-only migration with password | No      | Cannot portably produce Nest scrypt hashes           |
| Protected HTTP seed endpoint     | No      | Avoids extra attack surface under conditional freeze |

## Deliverables

| Path                               | Purpose                                         |
| ---------------------------------- | ----------------------------------------------- |
| `scripts/seed-local-admin.ts`      | Platform-role seed (tenant + user + membership) |
| `npm run seed:admin`               | Root package script                             |
| `apps/api/db/seeds/README.md`      | Operator instructions                           |
| `scripts/seed-local-admin.test.ts` | Config/safety unit tests                        |
| This task record                   | Governance / DX notes                           |

## How to use

```powershell
# 1) Schema + roles
$env:DATABASE_URL = 'postgresql://postgres:educore_local_only@127.0.0.1:5432/educore'
npm run db:migrate
npm run db:bootstrap-roles

# 2) Seed admin (platform role; password never logged)
$env:SEED_ADMIN_PASS = 'ChangeMe-Local-Only-1'
npm run seed:admin

# 3) Run API with educore_app pool
$env:EDUCORE_APP_DATABASE_URL = 'postgresql://educore_app:educore_app_local_only@127.0.0.1:5432/educore'
$env:EDUCORE_ENABLE_APP_DB = '1'
npm start --workspace=@educore/api

# 4) Login
# POST /api/v1/auth/login
# { "email": "admin@educore.local", "password": "ChangeMe-Local-Only-1",
#   "tenantId": "01900000-0010-7000-8000-000000000001" }
```

Reset password for existing seed user: `$env:SEED_ADMIN_RESET='1'`.

## Security & risk mitigation

| Risk                           | Mitigation                                                           |
| ------------------------------ | -------------------------------------------------------------------- |
| Weak shared password committed | Password only via env; not in repo                                   |
| Production accident            | Refuses `NODE_ENV=production` unless `SEED_ADMIN_ALLOW_PRODUCTION=1` |
| Nest using platform role       | Script uses platform URL; docs insist Nest = `educore_app` only      |
| Password / hash leakage        | Script never prints password or hash                                 |
| RLS bypass                     | Inserts only with `educore_platform` + dual trusted GUCs             |
| Open user APIs                 | **No** new business HTTP routes                                      |

## Non-goals

- Production identity provisioning / invite flows
- MFA enrollment
- Role assignment beyond active membership (RBAC seed optional later)

## Verification

```bash
npm run check
```

## Recommended next step

Optional: seed a default tenant role + `user_roles` row for permission smoke tests (still no HTTP user admin).
