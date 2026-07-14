# API database tooling (P0)

Migration and role bootstrap for `@educore/api`. **P0 ships tooling only** — no Identity/Tenant business tables.

## Roles (security)

| Role                | Purpose                                     | RLS                                                                 |
| ------------------- | ------------------------------------------- | ------------------------------------------------------------------- |
| `educore_migrator`  | Run migrations only (CI/local migrate jobs) | May bypass as needed during DDL                                     |
| `educore_app`       | Runtime NestJS connection                   | **FORCE ROW LEVEL SECURITY** required once tenant tables exist (P1) |
| Bootstrap superuser | Docker `POSTGRES_USER` (local only)         | Used solely to create roles / databases                             |

**Hard rule:** the NestJS application must never use the migrator or cluster superuser as its pool role.

## Layout

```text
apps/api/db/
  bootstrap/          # optional role setup (run once per environment)
  migrations/         # ordered *.up.sql / *.down.sql pairs
  README.md
```

## Commands (from repository root)

```bash
# Apply pending migrations (requires DATABASE_URL)
npm run db:migrate

# Roll back the last migration
npm run db:migrate:down

# Create educore_migrator + educore_app (requires admin DATABASE_URL)
npm run db:bootstrap-roles

# Print lifecycle notes for test DB
npm run db:test-lifecycle -- --help
```

## Environment

See root `.env.example` for `DATABASE_URL` / role password placeholders.  
Local defaults align with DEV-001 (`.env.docker.example`).

## Migration timeline (current)

| Migration                                      | Contents                                |
| ---------------------------------------------- | --------------------------------------- |
| `20260714100000_baseline_meta`                 | `schema_migrations` ledger (P0)         |
| `20260714110000_extensions`                    | pgcrypto, uuid-ossp, citext (P1)        |
| `20260714120000_catalog_permissions_and_plans` | Global `permissions` + `plans` (P1)     |
| `20260714130000_seed_catalogs`                 | Permission codes + baseline plans (P1)  |
| `20260714140000_rls_foundation`                | `app.*` helpers + FORCE RLS helper (P1) |
| `20260714150000_tenants_and_users`             | `tenants` + `users` DDL (P1)            |
| `20260714160000_tenants_users_rls`             | Pattern B/C policies + membership hook  |

**Not yet created:** `tenant_memberships`, sessions, organizations, roles, entitlements, …  
**Not yet done:** automated isolation suite (T11).

### RLS helpers (schema `app`)

| Function                               | Purpose                                    |
| -------------------------------------- | ------------------------------------------ |
| `app.current_tenant_id()`              | Read `app.current_tenant` GUC              |
| `app.current_user_id()`                | Read `app.current_user` GUC                |
| `app.is_platform_operator()`           | Break-glass flag                           |
| `app.tenant_isolation_passes(uuid)`    | Pattern A predicate                        |
| `app.enable_tenant_rls(regclass)`      | `ENABLE` + `FORCE` RLS on a table          |
| `app.can_see_tenant(uuid)`             | Pattern B visibility                       |
| `app.can_see_user(uuid)`               | Pattern C visibility (interim)             |
| `app.user_has_active_membership(uuid)` | Membership hook (false until table exists) |

Runtime connections must use **`educore_app`**. Migrations/bootstrap may use a privileged local user.
