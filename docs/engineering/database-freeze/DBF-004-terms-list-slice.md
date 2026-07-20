# Database Freeze — Terms Slice (DBF-004)

## Freeze status

| Field               | Value                                                                      |
| ------------------- | -------------------------------------------------------------------------- |
| Freeze ID           | `DBF-004`                                                                  |
| Title               | Database Freeze — Academic Structure `terms` (list + create helper)        |
| Version             | `1.1` (1.0 list-read; 1.1 create helper)                                   |
| Date                | 2026-07-21                                                                 |
| Authority           | Solo-operator provisional acceptance (SOLO-GOV-001)                        |
| Engine              | PostgreSQL                                                                 |
| Scope               | Academic Structure — `terms` table + `app.create_term`                     |
| Explicitly excluded | classes, streams, subjects, teacher_assignments, enrollments, PATCH/DELETE |

**Honesty qualifier:** Accepted under solo-operator acting seats — **not** independent multi-person external review.

## Purpose

Authorize the tenant-owned schema and write helper for `GET/POST /api/v1/terms` under ACF-004.

Does **not** authorize PATCH/DELETE or child resources (classes/streams/subjects).

**Detail note (ACF-004 rev 1.1):** `GET /api/v1/terms/{id}` reuses this table and SELECT-only Pattern A RLS — **no schema change** for get-by-id.

## Parent dependency

| Artifact | Path                                                                    |
| -------- | ----------------------------------------------------------------------- |
| DBF-003  | `docs/engineering/database-freeze/DBF-003-academic-years-list-slice.md` |
| Table    | `academic_years` (FK parent of `terms.academic_year_id`)                |

## Table `terms` (frozen)

| Column             | Type        | Constraints                                                     |
| ------------------ | ----------- | --------------------------------------------------------------- |
| `id`               | uuid        | PK                                                              |
| `tenant_id`        | uuid        | NOT NULL, FK → `tenants(id)` (Pattern A RLS denormalized)       |
| `academic_year_id` | uuid        | NOT NULL, FK → `academic_years(id)`                             |
| `name`             | text        | NOT NULL; length 1–200                                          |
| `code`             | text        | NULL; unique per (`tenant_id`, `academic_year_id`) when present |
| `starts_on`        | date        | NULL (optional)                                                 |
| `ends_on`          | date        | NULL (optional); CHECK when both set: `ends_on >= starts_on`    |
| `status`           | text        | NOT NULL; CHECK ∈ `draft`, `active`, `closed`                   |
| `created_at`       | timestamptz | NOT NULL, default now()                                         |
| `updated_at`       | timestamptz | NOT NULL, default now()                                         |

### Indexes

- `uq_terms_tenant_year_code` UNIQUE (`tenant_id`, `academic_year_id`, `code`) WHERE `code IS NOT NULL`
- `ix_terms_tenant_year_status` (`tenant_id`, `academic_year_id`, `status`)
- `ix_terms_tenant_year_starts_on` (`tenant_id`, `academic_year_id`, `starts_on` ASC NULLS LAST)

### List order (keyset)

`starts_on ASC NULLS LAST, id ASC` — chronological within a year; undated last.

### Integrity note (tenant_id ↔ parent year)

- **Write helper (rev 1.1)** enforces parent year exists with `y.tenant_id = p_tenant` before INSERT.
- `term.tenant_id` is always set to `p_tenant` (bound tenant) — must match parent year.
- Optional DB trigger CHECK remains out of scope.

### RLS

- FORCE RLS Pattern A (`tenant_id = app.current_tenant_id()`)
- `educore_app`: **SELECT only** on table
- INSERT/UPDATE/DELETE for app role: **REVOKED** on table
- Product create via SECURITY DEFINER `app.create_term` (rev 1.1)
- Platform role may have INSERT/UPDATE for seed/ops (not product HTTP)

### Write helper (rev 1.1)

`app.create_term(actor, tenant, term_id, academic_year_id, name, code, starts_on, ends_on, status)`

- SECURITY DEFINER; `SET search_path = public, app`
- Re-checks `app.auth_has_active_membership(actor, tenant)`
- Parent year check:  
  `EXISTS (SELECT 1 FROM academic_years y WHERE y.id = p_academic_year_id AND y.tenant_id = p_tenant_id)`  
  If missing → `RAISE` invalid_parameter (`22023`) with message `parent academic year not found`  
  (mapped to HTTP 400 VALIDATION_ERROR — no cross-tenant existence leak via 403/200)
- INSERT with `tenant_id = p_tenant` only
- GRANT EXECUTE to `educore_app`; table INSERT remains REVOKED
- Down migration drops function only (not table)

### Ownership

Bounded context: **Academic Structure**. Other modules must not write this table (ADR-001).

## Permission seed

**No new permission codes.**

| Code              | Source  | Notes                                                        |
| ----------------- | ------- | ------------------------------------------------------------ |
| `academic.read`   | DBF-003 | List/view terms                                              |
| `academic.manage` | DBF-003 | Create terms (P5); already seeded owner/admin, **not** staff |

No `term.read` / `term.manage`.

## Exclusions

- classes, streams, subjects, enrollments
- Term PATCH/DELETE product HTTP
- Nested path under academic-years (v1 uses flat `/terms`)

## Acceptance (solo-operator)

| Role                         | Status | Date       |
| ---------------------------- | ------ | ---------- |
| Database Architect (acting)  | Signed | 2026-07-21 |
| Security (acting)            | Signed | 2026-07-21 |
| Principal Architect (acting) | Signed | 2026-07-21 |

## Related

- Companion: [ACF-004-terms-list-slice.md](../api-contract-freeze/ACF-004-terms-list-slice.md)
- Parent: [DBF-003-academic-years-list-slice.md](./DBF-003-academic-years-list-slice.md)
- Implementation: IMP-003-P3 list; P4 detail; P5 create
