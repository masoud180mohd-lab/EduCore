# Database Freeze — Classes List Slice (DBF-005)

## Freeze status

| Field               | Value                                                                    |
| ------------------- | ------------------------------------------------------------------------ |
| Freeze ID           | `DBF-005`                                                                |
| Title               | Database Freeze — Academic Structure `classes` list-read                 |
| Version             | `1.1` (1.0 list; 1.1 create helper)                                      |
| Date                | 2026-07-21                                                               |
| Authority           | Solo-operator provisional acceptance (SOLO-GOV-001)                      |
| Engine              | PostgreSQL                                                               |
| Scope               | Academic Structure — `classes` table + create helper                     |
| Explicitly excluded | streams, subjects, enrollments, teacher_assignments, class PATCH/DELETE  |

**Honesty qualifier:** Accepted under solo-operator acting seats — **not** multi-party external review.

## Purpose

Authorize the smallest tenant-owned schema for `GET /api/v1/classes` under ACF-005.

## Parent dependencies

| Artifact | Table / freeze                          |
| -------- | --------------------------------------- |
| DBF-003  | `academic_years` (required parent)      |
| DBF-004  | `terms` (optional parent via `term_id`) |

## Table `classes` (frozen)

| Column             | Type        | Constraints                                                     |
| ------------------ | ----------- | --------------------------------------------------------------- |
| `id`               | uuid        | PK                                                              |
| `tenant_id`        | uuid        | NOT NULL, FK → `tenants(id)`                                    |
| `academic_year_id` | uuid        | NOT NULL, FK → `academic_years(id)`                             |
| `term_id`          | uuid        | NULL, FK → `terms(id)` (optional; year-scoped class allowed)    |
| `name`             | text        | NOT NULL; length 1–200                                          |
| `code`             | text        | NULL; unique per (`tenant_id`, `academic_year_id`) when present |
| `status`           | text        | NOT NULL; CHECK ∈ `draft`, `active`, `closed`                   |
| `created_at`       | timestamptz | NOT NULL, default now()                                         |
| `updated_at`       | timestamptz | NOT NULL, default now()                                         |

### Indexes

- `uq_classes_tenant_year_code` UNIQUE (`tenant_id`, `academic_year_id`, `code`) WHERE `code IS NOT NULL`
- `ix_classes_tenant_year_status` (`tenant_id`, `academic_year_id`, `status`)
- `ix_classes_tenant_year_name` (`tenant_id`, `academic_year_id`, `name` ASC)
- `ix_classes_tenant_term` (`tenant_id`, `term_id`) WHERE `term_id IS NOT NULL`

### List order (keyset)

`name ASC, id ASC`

### Integrity notes

- Future writes must ensure `class.tenant_id` matches parent year (and term if set).
- When `term_id` set, future writes should ensure term belongs to same tenant and preferably same `academic_year_id` (app/helper enforced on create; out of scope for list-read).

### RLS

- FORCE RLS Pattern A (`tenant_id = app.current_tenant_id()`)
- `educore_app`: **SELECT only**; INSERT/UPDATE/DELETE **REVOKED**
- Product create (rev 1.1): `app.create_class` SECURITY DEFINER; GRANT EXECUTE; membership + parent year (and term if set: same tenant + same academic_year_id)
- Platform: SELECT/INSERT/UPDATE for seed/ops

## Permission

Reuses `academic.read` / `academic.manage` (no new codes).

## Acceptance (solo-operator)

| Role                         | Status | Date       |
| ---------------------------- | ------ | ---------- |
| Database Architect (acting)  | Signed | 2026-07-21 |
| Security (acting)            | Signed | 2026-07-21 |
| Principal Architect (acting) | Signed | 2026-07-21 |

## Related

- Companion: [ACF-005-classes-list-slice.md](../api-contract-freeze/ACF-005-classes-list-slice.md)
- Implementation: IMP-003-C0
