# IMP-001 Phase P1 (partial) — Catalog Tables + RLS Foundation

## Outcome

Implement the first P1 increment: global catalog tables, seeds, and RLS helper functions — without tenant-owned business tables or domain application code.

## Status

**Complete** for the authorized partial scope.

## Tasks addressed

| ID              | Scope in this increment                                                         | Status                                         |
| --------------- | ------------------------------------------------------------------------------- | ---------------------------------------------- |
| IMP-001-T05     | Extensions + `permissions` + `plans` + seeds                                    | Done                                           |
| IMP-001-T10     | Foundation only: `app` schema helpers + FORCE RLS helper + catalog write revoke | Partial (full table policies remain for later) |
| IMP-001-T06–T09 | Tenant-owned / IAM / audit tables                                               | Deferred                                       |
| IMP-001-T11     | Automated isolation suite T1–T8                                                 | Deferred (requires tenant tables)              |

## Migrations added

| ID                                             | Purpose                                                        |
| ---------------------------------------------- | -------------------------------------------------------------- |
| `20260714110000_extensions`                    | pgcrypto, uuid-ossp, citext                                    |
| `20260714120000_catalog_permissions_and_plans` | Global catalog DDL                                             |
| `20260714130000_seed_catalogs`                 | 13 permission codes + 3 plans                                  |
| `20260714140000_rls_foundation`                | `app.current_tenant_id`, isolation helper, `enable_tenant_rls` |

## Skills applied

| Skill                       | Application                                             |
| --------------------------- | ------------------------------------------------------- |
| planning-and-task-breakdown | Split catalogs from tenant-owned tables                 |
| incremental-implementation  | Four small migrations; no controllers                   |
| spec-driven-development     | Columns/codes from DBF-001                              |
| security-and-hardening      | App read-only catalogs; FORCE RLS helper; GUC fail-soft |
| code-review-and-quality     | Structural tests for SQL; PR gate doc                   |
| api-and-interface-design    | Permission codes aligned with ACF-001 AuthZ vocabulary  |

## Security considerations

- Catalogs have **no tenant_id** and **no tenant RLS** (DBF Pattern E) — access control is app AuthZ + DB grants.
- `educore_app` is **SELECT-only** on `permissions` / `plans`.
- `app.enable_tenant_rls(regclass)` forces RLS for future tenant tables; policies still required per table.
- GUC readers return NULL on missing/invalid settings (fail closed for isolation predicate).

## Verification

```bash
npm run check
```

Optional with Docker:

```bash
npm run docker:up
npm run db:migrate
npm run db:bootstrap-roles
```

## Non-goals confirmed

- No NestJS business controllers/services
- No `tenants` / `users` / memberships / roles tables
- No Student/Finance modules

## Recommended next step

Continue P1 with **T06** (`tenants`, `users`) only after attaching example RLS policies and extending isolation tests — or complete **T10** policies in lockstep with first tenant-owned table.
