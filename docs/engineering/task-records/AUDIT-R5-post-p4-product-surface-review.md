# Post–Phase-4 RBAC Product Surface Review

**Audit ID:** AUDIT-R5  
**Date:** 2026-07-21  
**Reviewer role:** Principal Software Architect + Senior QA (adversarial; review-only)  
**Baseline:** Phase 4 RBAC foundation complete (`423d55f` / IMP-001 P4–P4d)  
**Prior audit:** [AUDIT-R4](./AUDIT-R4-read-increments-review.md) — P10–P13 remediations re-verified  
**HEAD reviewed:** `3dfa3ae` (`feat(attendance): land online attendance sessions and records (IMP-005)`)  
**Working tree:** clean; branch **1 commit ahead** of `origin/main` (attendance committed, not staged)  
**Governance posture:** Solo-operator (SOLO-GOV-001) — **this audit does NOT re-accept freezes or approve production go-live.**

---

## 1. Executive summary

Post–P4 product HTTP has grown from Identity/Tenant reads into a broad MVP surface: students, academic structure, enrollments, gated identity writes (P14–P17), and a full online attendance sessions/records API (IMP-005). Patterns are largely consistent (RequirePermission + session bind, DEFINER writes, idempotency on creates, audit publish, fail-closed repos, 404 no-enumeration). AUDIT-R4 High/Medium/Low remediations (P10–P13) **did land in code and task records**.

**Top 3 strengths**

1. **AuthZ wiring at HTTP layer** — `tests/integration/product-reads-authz.http.test.ts` now covers identity, students, academic, enrollments, and attendance (401/400/403/404 + idempotency denial matrices), closing AUDIT-R4’s “mock-only guard” gap for CI.
2. **Enrollment-backed attendance** — `app.upsert_attendance_record` raises `student not enrolled` (22023); service maps to validation; closed session → 409; UNIQUE (session, student) + UNIQUE class/stream/date.
3. **Twin mutation discipline** — creates require Idempotency-Key; body allowlists reject `tenantId`; writes via SECURITY DEFINER; educore_app SELECT + EXECUTE pattern held across students/academic/enrollments/attendance.

**Top 3 risks / weaknesses**

1. ~~**`npm run check` FAILS on HEAD**~~ — **Closed (2026-07-21):** Prettier-fixed `IMP-004-enrollments-program.md`; `npm run check` green. Residual High items remain live isolation + OpenAPI breadth.
2. **Live isolation unverified for product modules** — P10 live suite covers orgs + tenant_settings only. Students / academic / enrollments / attendance RLS+HTTP isolation is **unverified** this session (`DATABASE_URL` / `RUN_LIVE_DB_TESTS` unset). Do not claim isolation proven for those tables.
3. **OpenAPI machine contract stops at ACF-001** — ACF-002…009 exist as markdown freezes only; no OpenAPI YAML for students/academic/enrollments/attendance → harness cannot guard drift the way identity does.

**Overall risk:** **Medium**. No Critical AuthZ hole found on product controllers in static review. Residual tenancy risk is **assurance gap**, not proven leak. Format gate on HEAD is **fixed**.

**Recommendation:** **Continue roadmap** (frontend teacher attendance / assessment) with a **High backlog** for live product isolation + OpenAPI expansion. Do **not** treat this audit as freeze re-acceptance.

---

## 2. Inventory table

### Commit map (P4 RBAC → HEAD)

| Range                  | Programs               | Notes                                                               |
| ---------------------- | ---------------------- | ------------------------------------------------------------------- |
| `423d55f` … `cd2971f`+ | IMP-001 P5 tenants     | First product reads                                                 |
| … `20ed10f`            | IMP-001 P6–P9          | Orgs, memberships, settings, users list                             |
| `375b082` … `efe62d6`  | AUDIT-R4 → P10–P13     | HTTP AuthZ, live orgs/settings, cursor/Q5, GET users/:id, ILIKE/cap |
| `02ed7a8`              | IMP-001 P14–P17        | Settings PUT, memberships create, orgs create, users PATCH          |
| `4f90da6` … `664eb61`  | IMP-002 P0–P3          | Students list/detail/create/patch                                   |
| `befa3f5` … `7a3e266`  | IMP-003                | Years, terms, classes, streams, subjects                            |
| `9c112f0`              | IMP-004 E0–E4          | Enrollments                                                         |
| `023cf77`              | students/academic wrap | Informal commit message (hygiene)                                   |
| `3dfa3ae`              | IMP-005 A0–D1/O1       | Attendance online surface + offline docs                            |

### Product endpoints (HTTP)

| Endpoint                                                        | Module     | Permission                  | Task / freeze    | OpenAPI                 | Impl | Tests                           |
| --------------------------------------------------------------- | ---------- | --------------------------- | ---------------- | ----------------------- | ---- | ------------------------------- |
| `GET /tenants`                                                  | tenant     | auth + RLS                  | P5               | `listAccessibleTenants` | Yes  | HTTP + unit                     |
| `GET /tenants/current`                                          | tenant     | `tenant.read`               | P5c              | Yes                     | Yes  | HTTP + unit                     |
| `GET /tenants/:id`                                              | tenant     | `tenant.read` + path bind   | P5b/c            | Yes                     | Yes  | HTTP + unit                     |
| `GET/POST /organizations`                                       | tenant     | read / manage               | P6, P16          | Yes                     | Yes  | HTTP + unit                     |
| `GET /organizations/:id`                                        | tenant     | `organization.read`         | P7               | Yes                     | Yes  | HTTP + unit                     |
| `GET/PUT /tenant-settings`                                      | tenant     | read / manage               | P6c, P14         | Yes                     | Yes  | HTTP + unit                     |
| `GET/POST /memberships`                                         | identity   | `user.read` / `user.invite` | P6b, P15         | Yes                     | Yes  | HTTP + unit                     |
| `GET /memberships/:id`                                          | identity   | `user.read`                 | P7b              | Yes                     | Yes  | HTTP + unit                     |
| `GET /users`, `GET /users/:id`                                  | identity   | `user.read`                 | P9, P12          | Yes                     | Yes  | HTTP + unit                     |
| `PATCH /users/:id`                                              | identity   | membership + manage-or-self | P17              | Yes                     | Yes  | HTTP + unit                     |
| `GET/POST/PATCH /students`                                      | students   | student.read/manage         | IMP-002, ACF-002 | **No YAML**             | Yes  | HTTP + unit + tooling           |
| `GET/POST /academic-years` (+ `:id`)                            | academic   | academic.read/manage        | IMP-003, ACF-003 | **No YAML**             | Yes  | HTTP + unit                     |
| `GET/POST /terms` (+ `:id`)                                     | academic   | academic.read/manage        | ACF-004          | **No YAML**             | Yes  | HTTP + unit                     |
| `GET/POST /classes` (+ `:id`)                                   | academic   | academic.read/manage        | ACF-005          | **No YAML**             | Yes  | HTTP + unit                     |
| `GET/POST /streams` (+ `:id`)                                   | academic   | academic.read/manage        | ACF-006          | **No YAML**             | Yes  | HTTP + unit                     |
| `GET/POST /subjects` (+ `:id`)                                  | academic   | academic.read/manage        | ACF-007          | **No YAML**             | Yes  | HTTP + unit                     |
| `GET/POST/PATCH /enrollments` (+ `:id`)                         | academic   | academic.read/manage        | IMP-004, ACF-008 | **No YAML**             | Yes  | HTTP + unit + tooling           |
| `GET/POST /attendance-sessions` (+ `:id`, `/close`, `/records`) | attendance | attendance.read/manage      | IMP-005, ACF-009 | **No YAML**             | Yes  | HTTP (partial) + unit + tooling |

**Auth (supporting):** `POST /auth/login|refresh|logout|select-tenant`, `GET /auth/me` — out of product-permission matrix; not re-audited as P3.

**Skeleton controllers** (`@Controller()` empty): assessment, payments, etc. — correctly inert.

**Attendance note:** Product path is `AttendanceController` → `AttendanceSessionsService` → `AttendanceSessionsRepository`. Placeholder `ATTENDANCE_REPOSITORY` / `describeSkeleton()` remain DI-wired but unused by HTTP — **not** a placeholder product surface.

---

## 3. Per-endpoint scorecard (condensed by family)

| Family                                        | Contract                        | AuthZ                            | Isolation                                   | Pagination                 | Errors            | Tests                   | S      |
| --------------------------------------------- | ------------------------------- | -------------------------------- | ------------------------------------------- | -------------------------- | ----------------- | ----------------------- | ------ |
| Identity/Tenant reads (P5–P13)                | ACF+OpenAPI aligned (post-P10)  | Good                             | Live orgs/settings only; rest unit          | Cursor UUID 400            | Consistent        | HTTP + unit             | **A-** |
| Identity writes (P14–P17)                     | OpenAPI present                 | Good; P17 manage-or-self special | Unit/HTTP AuthZ; live writes **unverified** | N/A                        | Good              | HTTP + unit             | **B+** |
| Students (IMP-002)                            | ACF-002 md; **no OpenAPI**      | Good                             | Unverified live                             | Shared pagination + search | Good              | HTTP + unit             | **B**  |
| Academic years/terms/classes/streams/subjects | ACF-003..007 md; **no OpenAPI** | Good                             | Unverified live                             | Shared                     | Good              | HTTP + unit             | **B**  |
| Enrollments (IMP-004)                         | ACF-008 md; **no OpenAPI**      | Good                             | Unverified live                             | Shared + filters           | Good              | HTTP + unit             | **B**  |
| Attendance (IMP-005)                          | ACF-009 md; **no OpenAPI**      | Good (perms seeded + staff both) | Unverified live; enrollment gate in SQL     | Sessions list keyset       | Good (409 closed) | HTTP **partial** + unit | **B**  |

**Legend:** A = strong evidence; B = MVP acceptable with named gaps; C = block further increments.

No family scored **C**. Attendance is **B** (not C) because enrollment dependency exists and is enforced in DEFINER SQL — but live proof and OpenAPI are missing.

---

## 4. Consistency review

### AuthZ

| Pattern                                                                         | Status                                                                                                            |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `RequirePermission` on privileged product routes                                | **Yes** (students, academic, enrollments, attendance, org/membership/settings/users reads)                        |
| Session↔header bind via guard                                                   | **Yes** for RequirePermission routes                                                                              |
| `GET /tenants` auth-only picker                                                 | **Intentional**                                                                                                   |
| `PATCH /users/:id` uses `RequireActiveMembershipGuard` + service manage-or-self | **Intentional (P17)** — different from other mutations                                                            |
| Staff permissions                                                               | Reads + **`attendance.manage`** (IMP-005 teacher flow) — expands write surface vs “read-oriented staff” narrative |

### Errors / envelopes

| Concern                                                            | Consistent?                       |
| ------------------------------------------------------------------ | --------------------------------- |
| `{ data, page: { nextCursor, limit } }` lists                      | Yes (except tenants picker)       |
| Detail miss → generic 404                                          | Yes across reviewed services      |
| Fail-closed list empty / detail 404 when pool null                 | Yes                               |
| Invalid cursor → 400                                               | Yes (P11; `cursor-pagination.ts`) |
| Idempotency required on POST creates                               | Yes                               |
| Idempotency optional on PATCH / close / settings PUT / users PATCH | Yes (documented variance)         |

### Pagination / search

- Shared `parsePaginationQuery` + UUID cursor validation (P11 closed).
- Shared `parseOptionalSearchFilter` / ILIKE escape (P13) used by orgs/users/students.
- Tenants soft cap 100 + warn (P13).

### Modules / boundaries

- `npm run boundaries:check` **PASS** (252 modules).
- Attendance does not leak into academic-structure controllers (structural test asserts).

---

## 5. Security & isolation review

### Doubt probes (explicit answers)

| Probe                                             | Answer                                                                                       | Evidence                                                                                                              |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Other-tenant `classId`/`studentId` on create?     | **No (intended)** — helpers raise `class not found` / `student not found` under tenant scope | enrollments + attendance helpers; service maps 22023                                                                  |
| Mark attendance for non-enrolled student?         | **No**                                                                                       | `upsert_attendance_record` … `student not enrolled`                                                                   |
| GET by id leak cross-tenant existence?            | **No (intended)** — 404                                                                      | Service/repo pattern; HTTP tests use invalid/unknown UUID                                                             |
| Session tenant mismatch on representative routes? | **Denied 403** in HTTP harness                                                               | `product-reads-authz.http.test.ts` (orgs, students, academic, users, settings) — attendance mismatch coverage thinner |
| Double POST same idempotency key?                 | **Replay** when store present                                                                | Unit tests (students/terms/subjects/attendance create)                                                                |
| Duplicate enrollment / attendance session day?    | Unique constraints + CONFLICT mapping                                                        | Migrations + service 23505 → CONFLICT                                                                                 |
| ILIKE metacharacter injection?                    | Escaped                                                                                      | `ilike-escape.ts` + unit tests                                                                                        |
| Closed attendance → record PUT?                   | **Rejected** (409)                                                                           | Service pre-check + helper `session closed`                                                                           |

### Stream-scoped enrollment gate (Medium)

Attendance helper allows mark when:

```sql
(v_stream_id IS NULL OR e.stream_id IS NULL OR e.stream_id = v_stream_id)
```

If session is stream-scoped but enrollment has `stream_id IS NULL`, student can still be marked. Product may intend “class enrollment covers all streams”; if stream-strictness is required, this is a **semantic hole**. ACF-009 says “active enrollment for session class” (stream not strictly required) — **document vs tighten**.

### Threat summary

| Threat                         | Severity        | Notes                                                                               |
| ------------------------------ | --------------- | ----------------------------------------------------------------------------------- |
| Cross-tenant read/write        | Residual Medium | Static + HTTP AuthZ strong; **live RLS for product tables unverified this session** |
| Privilege escalation via staff | Low–Medium      | Staff has `attendance.manage` by design                                             |
| Existence enumeration          | Low             | 404 pattern held                                                                    |
| Injection                      | Low             | Parameterized SQL / DEFINER                                                         |
| Silent mutations               | Low             | Audit actions present on reviewed writes                                            |

---

## 6. Performance & scalability

| Area                                         | MVP OK?             | 10k+ concern                                                                 |
| -------------------------------------------- | ------------------- | ---------------------------------------------------------------------------- |
| Keyset list pagination (limit ≤100)          | Yes                 | OK if indexes match order                                                    |
| Attendance records GET (full array, no page) | OK for class size   | Large class/day may need paging later                                        |
| Tenants picker soft cap 100                  | Yes                 | Warn path exists                                                             |
| Bulk PUT records (loop helpers in one txn)   | OK for class roster | Very large payloads → latency; no max array size asserted in audit deep-dive |

---

## 7. OpenAPI / ACF alignment matrix

| Surface                                | ACF md      | OpenAPI YAML                           | Alignment                  |
| -------------------------------------- | ----------- | -------------------------------------- | -------------------------- |
| Identity/Tenant (ACF-001)              | Yes         | `acf-001-identity-tenant.openapi.yaml` | **Aligned** (post P10/P12) |
| Students (ACF-002)                     | Yes         | **Missing**                            | Markdown-only              |
| Academic years–subjects (ACF-003..007) | Yes         | **Missing**                            | Markdown-only              |
| Enrollments (ACF-008)                  | Yes         | **Missing**                            | Markdown-only              |
| Attendance (ACF-009)                   | Yes rev 1.3 | **Missing**                            | Markdown-only              |
| x-authz session bind (identity)        | Documented  | Present on privileged GETs             | Aligned (P10)              |
| Product OpenAPI harness sync           | —           | Identity-only tooling                  | **Gap** for IMP-002+       |

---

## 8. Test evidence map

| Risk                                              | Covered by                                | Gap?                                                              |
| ------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------- |
| HTTP AuthZ + session bind (identity + product)    | `product-reads-authz.http.test.ts`        | **Partial** — attendance missing close/records-GET/mismatch cases |
| Live RLS orgs/settings                            | `product-reads.live.test.ts`              | OK when DB present                                                |
| Live RLS students/academic/enrollments/attendance | —                                         | **Yes — unverified**                                              |
| Cursor UUID validation                            | `cursor-pagination.test.ts` + services    | Closed (P11)                                                      |
| ILIKE escape                                      | `ilike-escape.test.ts`                    | Closed (P13)                                                      |
| GET /users/:id AuthZ                              | HTTP matrix + P12 record                  | Closed                                                            |
| Attendance enrollment gate                        | Migration string + service unit mapping   | **No live HTTP write path**                                       |
| Attendance closed session                         | Service unit                              | No HTTP integration write with DB                                 |
| Module boundaries                                 | `boundaries:check`                        | OK                                                                |
| Structural IMP-005                                | `tests/tooling/imp005-attendance.test.ts` | OK                                                                |
| `npm run check` full gate                         | format:check                              | **PASS** after IMP-004 Prettier fix (2026-07-21)                  |

### Commands run this review session

```text
git log / git status
  → HEAD 3dfa3ae; ahead origin/main by 1 (pre-fix)

DATABASE_URL / RUN_LIVE_DB_TESTS / PGHOST / PGDATABASE
  → all UNSET → live isolation NOT RUN (explicitly unverified)

npm run check (initial review)
  → FAIL at format:check (IMP-004-enrollments-program.md)

npm run check (after Prettier fix, 2026-07-21)
  → PASS (110 files; 674 passed | 2 skipped; boundaries OK)
```

**Not run:** `RUN_LIVE_DB_TESTS=1` any isolation suite.

---

## 9. Gaps & missing features

**Product completeness (honest)**

1. No OpenAPI YAML for ACF-002…009 (frontend/codegen friction).
2. Attendance Wave O = docs only (correct per program); no offline worker.
3. PATCH single attendance record skipped (bulk PUT OK).
4. Live multi-tenant matrix for students/academic/enrollments/attendance not built.
5. Attendance HTTP AuthZ matrix incomplete vs create/list coverage.
6. Roles/permissions admin HTTP, entitlements list — still out of scope (ACF-001 residual).
7. Informal commit `023cf77` (“Nimemalizia…”) — hygiene debt.

**Completeness that is good**

- Enrollments present → Attendance correctly proceeded (no fake student↔class link).
- Permission catalogue includes `attendance.read`/`manage`; staff grants both.
- Skeleton BCs remain closed.

---

## 10. Improvement backlog

### Critical

| Finding                                                  | Evidence | Impact | Recommendation | Effort | Suggested id |
| -------------------------------------------------------- | -------- | ------ | -------------- | ------ | ------------ |
| _(none — no exploitable Critical AuthZ hole identified)_ | —        | —      | —              | —      | —            |

### High

| Finding                                             | Evidence                                                  | Impact                                                       | Recommendation                                      | Effort | Suggested id                               |
| --------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------- | ------ | ------------------------------------------ |
| ~~Format gate fail on IMP-004 md~~                  | Fixed 2026-07-21                                          | —                                                            | **Closed**                                          | S      | chore(docs): prettier IMP-004              |
| Live product isolation missing beyond orgs/settings | `product-reads.live.test.ts` scope; DB unset this session | False confidence on tenancy for students/academic/attendance | Extend live SQL+HTTP matrix; run with Postgres      | M      | IMP-005-D3-live-isolation (or IMP-00x-P18) |
| No OpenAPI for product slices                       | only `acf-001-*.yaml`                                     | Contract drift; no harness                                   | Add OpenAPI (or monorepo yaml) + tooling sync tests | M      | IMP-OPENAPI-product-slices                 |

### Medium

| Finding                                               | Evidence                                      | Impact                                            | Recommendation                                            | Effort | Suggested id                 |
| ----------------------------------------------------- | --------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------- | ------ | ---------------------------- |
| Attendance HTTP AuthZ incomplete                      | No close 403 / records GET / mismatch tests   | Regression net holes                              | Extend `product-reads-authz.http.test.ts`                 | S      | IMP-005-D1b                  |
| Stream-null enrollment can mark stream-scoped session | helper SQL OR `e.stream_id IS NULL`           | Possible over-mark if product wants stream-strict | Product decision → tighten helper or document in ACF-009  | S      | IMP-005-D4-stream-enrollment |
| Attendance placeholder DI still wired                 | `attendance.module.ts` placeholder + skeleton | Confusion / dead code                             | Remove or clearly quarantine                              | S      | IMP-005-D5-cleanup           |
| Optional idempotency on PATCH/close/settings          | services use `parseIdempotencyKey`            | Offline replay weaker                             | Keep intentional; freeze note already Wave O              | —      | FYI                          |
| Informal commit message on `023cf77`                  | git log                                       | History noise                                     | Avoid in future; no rewrite of pushed history without ask | —      | process                      |

### Low

| Finding                                         | Evidence                        | Impact          | Recommendation                  | Effort |
| ----------------------------------------------- | ------------------------------- | --------------- | ------------------------------- | ------ |
| PG error string matching per service            | attendance/enrollments services | Fragile mapping | Shared mapper later             | M      |
| Attendance records list unpaged                 | ACF-009 / controller            | Scale           | Page when needed                | M      |
| Staff “read-oriented” docs vs attendance.manage | system-roles comment updated    | Doc clarity     | Keep ACF-009 as source of truth | S      |

### FYI / intentional

- Solo-operator freezes remain provisional.
- Wave O offline docs only (`IMP-005-O1`).
- PATCH single attendance record skipped.
- This audit is **not** production sign-off.

---

## 11. AUDIT-R4 regression check (P10–P13)

| Prior finding                      | Remediation                            | Status at HEAD                                                      |
| ---------------------------------- | -------------------------------------- | ------------------------------------------------------------------- |
| No HTTP AuthZ on product reads     | P10 `product-reads-authz.http.test.ts` | **Closed** (+ extended to students/academic/enrollments/attendance) |
| No live orgs/settings isolation    | P10 `product-reads.live.test.ts`       | **Closed for orgs/settings**; product modules still open            |
| OpenAPI P8 filters / x-authz drift | P10 OpenAPI + tooling                  | **Closed for ACF-001**                                              |
| Invalid cursor → empty page        | P11 UUID → 400                         | **Closed**                                                          |
| Users cursor tenant scope / Q5     | P11                                    | **Closed** (per task record + code)                                 |
| Missing `GET /users/{id}`          | P12                                    | **Closed**                                                          |
| Duplicated ILIKE / tenants cap     | P13                                    | **Closed**                                                          |

**Verdict:** AUDIT-R4 High/Medium/Low backlog items for Identity/Tenant reads are **substantively closed**. Remaining High items are **post-R4 expansion debt** (live product tables, OpenAPI breadth); the format-gate finding is closed.

---

## 12. Solo-operator honesty — what this audit does NOT prove

1. Does **not** prove live RLS isolation for students, academic, enrollments, or attendance (DB unavailable this session).
2. Does **not** re-run or re-sign DBF/ACF freezes or FREEZE-ACC gates.
3. Does **not** prove production readiness, load, or ops (backups, rate limits, secrets rotation).
4. Does **not** exercise real teacher multi-tenant manual QA (script may exist; not executed here).
5. Does **not** prove OpenAPI ↔ implementation for IMP-002…005 (no YAML).
6. Controllers unit tests still invoke handlers **without** Nest guard pipeline — HTTP suite is the guard proof.
7. Peer-independent review did not occur (solo-operator residual).
8. ~~`npm run check` not green due to Prettier~~ — **resolved** after IMP-004 format fix (re-run PASS). Live isolation and OpenAPI breadth remain unproven.

---

## 13. Revision history

| Rev | Date       | Notes                                                                                                |
| --- | ---------- | ---------------------------------------------------------------------------------------------------- |
| 1.0 | 2026-07-21 | Initial AUDIT-R5: P4→HEAD including committed IMP-005; commands recorded; review-only                |
| 1.1 | 2026-07-21 | Closed High format-gate finding; `npm run check` re-verified PASS; recommendation → continue roadmap |

---

## Appendix — five-axis self-check (on this audit)

| Axis         | Check                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Correctness  | Claims tied to files/tests/commands; live isolation marked unverified |
| Readability  | Tables + backlog ids for EM action                                    |
| Architecture | Twin patterns compared across IMP-002…005                             |
| Security     | Tenancy/AuthZ prioritized; stream enrollment called out               |
| Performance  | List/cap/records paging named                                         |

---

## Executive handoff (10 lines)

1. **Safe to continue roadmap?** Yes — format gate fixed; AuthZ patterns coherent; enrollments green; attendance enrollment-gated.
2. **`npm run check`?** **PASS** after Prettier fix on `IMP-004-enrollments-program.md`.
3. **Safe to claim live isolation for attendance/students?** **No** — unverified this session.
4. **AUDIT-R4 P10–P13?** Landed; Identity OpenAPI/HTTP gaps closed; live still identity-scoped.
5. **IMP-005 HTTP?** Implemented and committed (`3dfa3ae`); not placeholder; skeleton DI leftover only.
6. **Critical AuthZ holes?** None found in static+HTTP harness review.
7. **Highest next assurance work:** live product isolation matrix + OpenAPI for ACF-002…009.
8. **Next product work:** frontend teacher attendance UI and/or assessment — without treating this audit as freeze re-acceptance.
9. **Continue IMP-005 further?** Online surface done; optional D1b AuthZ fill + stream semantics decision.
10. **This document ≠ freeze acceptance / go-live.**

_End of AUDIT-R5_
