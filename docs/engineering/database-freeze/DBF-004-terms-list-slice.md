# Database Freeze — Terms List Slice (DBF-004)

## Freeze status

| Field               | Value                                                                     |
| ------------------- | ------------------------------------------------------------------------- |
| Freeze ID           | `DBF-004`                                                                 |
| Title               | Database Freeze — Academic Structure `terms` list-read                    |
| Version             | `1.0`                                                                     |
| Date                | 2026-07-20                                                                |
| Authority           | Solo-operator provisional acceptance (SOLO-GOV-001)                       |
| Engine              | PostgreSQL                                                                |
| Scope               | Academic Structure — `terms` table only (list read)                       |
| Explicitly excluded | classes, streams, subjects, teacher_assignments, enrollments, term writes |

**Honesty qualifier:** Accepted under solo-operator acting seats — **not** independent multi-person external review.

## Purpose

Authorize the **smallest** tenant-owned schema needed for `GET /api/v1/terms` under ACF-004.

Does **not** authorize term writes or child resources (classes/streams/subjects).

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

- Application/helper on **future writes** must ensure `term.tenant_id = parent year.tenant_id`.
- Optional DB trigger CHECK is **out of scope** for P3 list-read.
- For list-read: FK to `academic_years` + denormalized `tenant_id` + Pattern A RLS is sufficient.
  Rows seeded/inserted out-of-band with mismatched tenant would still be filtered by RLS on `tenant_id`.

### RLS

- FORCE RLS Pattern A (`tenant_id = app.current_tenant_id()`)
- `educore_app`: **SELECT only** on table
- INSERT/UPDATE/DELETE for app role: **REVOKED** on table
- Platform role may have INSERT/UPDATE for seed/ops (not product HTTP)
- No SECURITY DEFINER write helper in this freeze

### Ownership

Bounded context: **Academic Structure**. Other modules must not write this table (ADR-001).

## Permission seed

**No new permission codes.** Product list reuses `academic.read` seeded in DBF-003 / migration `20260720180000_academic_years_list_read`.

| Code            | Source  | Notes                                              |
| --------------- | ------- | -------------------------------------------------- |
| `academic.read` | DBF-003 | List/view academic structure (includes terms list) |

No `term.read` / `term.manage` in P3.

## Exclusions

- classes, streams, subjects, enrollments
- Term POST/PATCH/DELETE product HTTP
- Nested path under academic-years (v1 uses flat `/terms`)

## Acceptance (solo-operator)

| Role                         | Status | Date       |
| ---------------------------- | ------ | ---------- |
| Database Architect (acting)  | Signed | 2026-07-20 |
| Security (acting)            | Signed | 2026-07-20 |
| Principal Architect (acting) | Signed | 2026-07-20 |

## Related

- Companion: [ACF-004-terms-list-slice.md](../api-contract-freeze/ACF-004-terms-list-slice.md)
- Parent: [DBF-003-academic-years-list-slice.md](./DBF-003-academic-years-list-slice.md)
- Implementation: IMP-003-P3 terms list read
