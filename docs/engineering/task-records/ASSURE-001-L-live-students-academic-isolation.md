# ASSURE-001-L — Live students/academic isolation

| Field     | Value                     |
| --------- | ------------------------- |
| Program   | ASSURE-001                |
| Wave      | L (Live isolation)        |
| Date      | 2026-07-21                |
| Authority | Solo-operator provisional |

## Outcome

Add Postgres-backed evidence suite for students + academic (separate from identity `product-reads.live.test.ts`).

## Suite

`tests/isolation/product-students-academic.live.test.ts`

| Layer   | Coverage                                                                 |
| ------- | ------------------------------------------------------------------------ |
| SQL RLS | `students`, `classes` (educore_app tenant A ↛ B)                         |
| HTTP    | students list/get; academic-years list/get; classes get; subjects list   |
| AuthZ   | 401 no bearer; 400 no tenant; 403 session mismatch; 404 cross-tenant ids |

## Env

```text
RUN_LIVE_DB_TESTS=1          # fail if DB unreachable
DATABASE_URL / POSTGRES_*    # admin
SEED_ADMIN_PASS              # seed login
EDUCORE_ENABLE_APP_DB=1      # set by suite for HTTP
```

## Transcript

| Command                                 | Result                                        |
| --------------------------------------- | --------------------------------------------- |
| `npm run check` (suite land)            | **PASS** (113 files; 698 passed \| 3 skipped) |
| Live run 2026-07-21 (local Postgres 16) | **PASS** — 18 passed \| 2 skipped             |

```text
RUN_LIVE_DB_TESTS=1
DATABASE_URL=SET (127.0.0.1:5432)
SEED_ADMIN_PASS=SET
EDUCORE_ENABLE_APP_DB=1

npx vitest run tests/isolation/product-students-academic.live.test.ts \
              tests/isolation/product-reads.live.test.ts

→ Test Files  2 passed (2)
→ Tests      18 passed | 2 skipped (20)
```

Proven: SQL RLS for `students`/`classes`; HTTP AuthZ + cross-tenant 404/403 for students/academic; P10 orgs/settings live matrix re-verified.

## Residual risk

None for ASSURE-001-L evidence on this operator machine. CI without Postgres still skips (by design).
