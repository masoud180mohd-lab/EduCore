# API database tooling

Migration and role bootstrap for `@educore/api`. Schema is applied via ordered SQL migrations (IMP-001 / AUDIT-R2). NestJS still has no domain HTTP controllers wired to these tables.

## Roles (security)

| Role                | Purpose                             | Notes                                                        |
| ------------------- | ----------------------------------- | ------------------------------------------------------------ |
| `educore_migrator`  | Run migrations only                 | Never NestJS pool                                            |
| `educore_app`       | Runtime NestJS connection           | FORCE RLS; **no INSERT** on `tenants`/`users` after AUDIT-R2 |
| `educore_platform`  | Trusted local provisioning INSERT   | Never NestJS pool; requires trusted platform GUCs            |
| Bootstrap superuser | Docker `POSTGRES_USER` (local only) | Create roles / databases only                                |

**Hard rule:** the NestJS application must never use migrator, platform, or cluster superuser as its pool role.

## Layout

```text
apps/api/db/
  bootstrap/          # role setup (run once per environment)
  migrations/         # ordered *.up.sql / *.down.sql pairs
  README.md
```

## Commands (from repository root)

Requires Docker Postgres (`npm run docker:up`) first.

```bash
npm run db:migrate
npm run db:migrate:down
npm run db:bootstrap-roles
npm run db:test-lifecycle -- --help
```

## Environment

Uses `DATABASE_URL` or DEV-001 defaults (`educore` / `educore_local_only` on `127.0.0.1:5432`). Connection URLs are redacted in script output.

## Governance

Provisional Identity/Tenant SQL is under **conditional** freeze acceptance:
`docs/engineering/gates/FREEZE_ACCEPTANCE_IDENTITY_TENANT.md`.

## Recent migrations (P1 memberships)

| ID                                      | Purpose                       |
| --------------------------------------- | ----------------------------- |
| `20260714180000_tenant_memberships`     | `tenant_memberships` table    |
| `20260714190000_membership_rls_helpers` | Real membership helpers + RLS |

Membership INSERT remains **`educore_platform`** only (no Nest domain routes yet).
