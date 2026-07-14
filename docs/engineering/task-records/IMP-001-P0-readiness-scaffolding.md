# IMP-001 Phase P0 — Readiness & Scaffolding

## Outcome

Complete Phase P0 foundations for Identity & Tenant implementation: go/no-go gate, migration tooling with empty baseline, database role bootstrap, OpenAPI contract harness skeleton, and test DB lifecycle guidance — **without** business schema or domain controllers.

## Status

**Complete** for authorized P0 scope (CONDITIONAL GO).

## Tasks completed

| ID          | Title                                                         | Status            |
| ----------- | ------------------------------------------------------------- | ----------------- |
| IMP-001-T01 | Go/No-Go gate + PR checklist                                  | Done              |
| IMP-001-T02 | Migration tooling + roles + baseline meta migration           | Done              |
| IMP-001-T03 | Contract-test harness skeleton (OpenAPI load + error fixture) | Done (foundation) |
| IMP-001-T04 | Test DB lifecycle documentation + helper script               | Done (foundation) |

## Deliverables

| Path                                                         | Role                                              |
| ------------------------------------------------------------ | ------------------------------------------------- |
| `docs/engineering/gates/IMP-001-P0-go-no-go.md`              | Gate decision (P0 GO / P1 NO-GO until signatures) |
| `docs/engineering/templates/PR_CHECKLIST_IDENTITY_TENANT.md` | PR policy for slice work                          |
| `apps/api/db/**`                                             | Migrations dir, bootstrap roles SQL, README       |
| `scripts/db-migrate.ts`                                      | Up/down SQL migrator                              |
| `scripts/db-bootstrap-roles.ts`                              | Role bootstrap runner                             |
| `scripts/db-test-lifecycle.ts`                               | Lifecycle guidance / optional migrate             |
| `tests/contract/openapi-harness.test.ts`                     | OpenAPI + error envelope harness                  |
| `tests/tooling/migration-tooling.test.ts`                    | Tooling structural tests                          |

## Skills applied

| Skill                       | Application                                                       |
| --------------------------- | ----------------------------------------------------------------- |
| planning-and-task-breakdown | Executed only T01–T04 foundations; deferred P1 tables             |
| incremental-implementation  | Empty baseline only; no domain controllers                        |
| spec-driven-development     | Gate + tests reference DBF-001 / ACF-001 / OpenAPI                |
| api-and-interface-design    | Error envelope fixture matches ACF-001 shape                      |
| security-and-hardening      | educore_app vs migrator; redacted DB URLs; no business RLS bypass |
| code-review-and-quality     | PR checklist; automated tooling tests; `npm run check`            |

## Security notes

- Runtime role `educore_app` is distinct from `educore_migrator`.
- FORCE RLS is documented for P1; not applied yet because no tenant tables exist.
- Migration/bootstrap scripts never print full connection strings with passwords.
- Baseline migration creates **only** `schema_migrations`.

## Verification

```bash
npm run check
```

Optional (requires Docker Postgres):

```bash
npm run docker:up
npm run db:migrate
npm run db:bootstrap-roles
npm run db:migrate:down
```

## Explicit non-goals confirmed

- No `tenants` / `users` / other DBF-001 business tables
- No NestJS Identity/Tenant business services or controllers
- No Student/Finance modules

## Residual risks / blockers

1. Formal DBF-001 / ACF-001 signatures still open → **P1 remains NO-GO**.
2. Live migrate not verified on hosts without Docker.
3. Default role passwords are local-only placeholders.

## Recommended next step

Obtain freeze signatures, then start **Phase P1** at `IMP-001-T05` (extensions + permission/plan catalogs) with RLS workstream T10 as the security critical path.
