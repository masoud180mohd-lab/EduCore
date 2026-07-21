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

## Transcript (this session)

| Command                     | Result                                                                             |
| --------------------------- | ---------------------------------------------------------------------------------- |
| `npm run check`             | (recorded after suite lands)                                                       |
| Live suite without Postgres | **SKIP** (describe.skipIf) — residual: isolation **unverified** until Postgres run |
| `RUN_LIVE_DB_TESTS=1`       | Run when local Postgres available; do not claim PASS without transcript            |

## Residual risk

Until `RUN_LIVE_DB_TESTS=1` passes on operator Postgres: tenancy for students/academic rests on unit + CI HTTP AuthZ harness + this suite’s skip path — **not** live proof.
