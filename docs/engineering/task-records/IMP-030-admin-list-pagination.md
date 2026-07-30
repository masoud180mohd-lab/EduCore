# IMP-030 — Admin list pagination (Load more)

| Field     | Value                                                    |
| --------- | -------------------------------------------------------- |
| Program   | **IMP-030**                                              |
| Date      | 2026-07-27                                               |
| From      | AUDIT-ADMIN-UI-R1 G2 / T2                                |
| Freezes   | DSF-002 rev 1.17; ACF list envelopes (`page.nextCursor`) |
| Depends   | IMP-027 ResourceList; IMP-033 AuthZ gate (preserved)     |
| Authority | Solo-operator provisional                                |

## Goal

Stop silently truncating admin registries at `limit=50|100`. When the API returns `page.nextCursor`, operators can **Load more** and append rows with the same filters.

## Inventory (route → endpoint → limit)

| Route                         | Endpoint              | Limit | Migrated               |
| ----------------------------- | --------------------- | ----- | ---------------------- |
| `/admin/students`             | `GET /students`       | 50    | Yes (search preserved) |
| `/admin/users`                | `GET /users`          | 50    | Yes (search preserved) |
| `/admin/guardians`            | `GET /guardians`      | 50    | Yes                    |
| `/admin/organizations`        | `GET /organizations`  | 50    | Yes (search preserved) |
| `/admin/memberships`          | `GET /memberships`    | 50    | Yes (status filter)    |
| `/admin/roles`                | `GET /roles`          | 100   | Yes                    |
| `/admin/academic/years`       | `GET /academic-years` | 50    | Yes                    |
| `/admin/academic/terms`       | `GET /terms`          | 50    | Yes (year filter)      |
| `/admin/academic/classes`     | `GET /classes`        | 50    | Yes (year filter)      |
| `/admin/academic/streams`     | `GET /streams`        | 50    | Yes (class filter)     |
| `/admin/academic/subjects`    | `GET /subjects`       | 100   | Yes                    |
| `/admin/academic/enrollments` | `GET /enrollments`    | 50    | Yes (class + status)   |
| `/admin/fees/structures`      | `GET /fee-structures` | 50    | Yes                    |
| `/admin/fees/invoices`        | `GET /invoices`       | 50    | Yes                    |
| `/admin/fees/receipts`        | `GET /receipts`       | 50    | Yes                    |

## Shared primitive

| Piece       | Path                                                       |
| ----------- | ---------------------------------------------------------- |
| Helper      | `apps/web/src/lib/admin/list-pagination.ts`                |
| Unit tests  | `…/list-pagination.test.ts`                                |
| Control     | `apps/web/src/components/admin/ResourceListPagination.tsx` |
| Footer slot | `ResourceList` optional `footer`                           |
| Tokens      | `.resource-list-pagination`                                |

Helpers: `buildListQuery`, `readPageMeta`, `appendById`, `hasMorePages`, `ADMIN_LIST_DEFAULT_LIMIT=50`.

## Waves

| Wave                             | Status                 |
| -------------------------------- | ---------------------- |
| P0 inventory + DSF-002 amend     | Done                   |
| P1 helper + pagination control   | Done                   |
| P2 registries                    | Done                   |
| P3 academic + fees (+ roles)     | Done                   |
| P4 tooling + check + task record | Done                   |
| Wave X pickers / teacher lists   | **Done** (P0 pickers — see IMP-030x) |

## Residuals

- Teacher / parent **list** pages out of MVP (not form pickers).
- No Playwright multi-page harness in this program.
- Admin form/detail pickers: see IMP-030x (closed).

## Doubt checks

| Question                                            | Answer                           |
| --------------------------------------------------- | -------------------------------- |
| Can a 60th student appear via Load more?            | Yes, if API returns `nextCursor` |
| Does search + Load more keep the search term?       | Yes (`appliedSearch`)            |
| Does changing status filter reset list?             | Yes (memberships / enrollments)  |
| Do we claim “all loaded” when nextCursor still set? | No — button stays until null     |

## Five-axis notes (brief)

| Axis            | Note                                                                   |
| --------------- | ---------------------------------------------------------------------- |
| Correctness     | Consumes ACF `page` as-is; missing `page` → treat exhausted            |
| Security        | Opaque cursor; Bearer + tenant header unchanged; IMP-033 nav untouched |
| UX              | Distinct loading-more; recoverable errors leave prior rows             |
| Maintainability | One helper + one footer control; no per-page fetch-loop copy           |
| Ops             | No fake totals; silent truncate fixed on migrated lists                |

## Verify

```bash
npx vitest run apps/web/src/lib/admin/list-pagination.test.ts tests/tooling/imp030-admin-list-pagination.test.ts
npm run check
```

## Manual QA script

1. Seed or create >50 students (or mock `nextCursor`).
2. Open Students → first page → **Load more** appends; button hides when `nextCursor` null.
3. Search → list resets; Load more keeps search.
4. Memberships: change status → list resets; Load more keeps status.
5. Force second-page 403/network → banner error; prior rows remain; retry possible.
