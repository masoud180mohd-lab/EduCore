# Database Freeze — Academic Years List Slice (DBF-003)

## Freeze status

| Field               | Value                                                                            |
| ------------------- | -------------------------------------------------------------------------------- |
| Freeze ID           | `DBF-003`                                                                        |
| Title               | Database Freeze — Academic Structure academic_years list-read                    |
| Version             | `1.1` (1.0 list-read; 1.1 create helper)                                         |
| Date                | 2026-07-20                                                                       |
| Authority           | Solo-operator provisional acceptance (SOLO-GOV-001)                              |
| Engine              | PostgreSQL                                                                       |
| Scope               | Academic Structure — `academic_years` table only (list read)                     |
| Explicitly excluded | terms, classes, streams, subjects, teacher_assignments, enrollments, students FK |

**Honesty qualifier:** Accepted under solo-operator acting seats — **not** independent multi-person external review.

## Purpose

Authorize the **smallest** tenant-owned schema needed for `GET /api/v1/academic-years` under ACF-003.

Does **not** authorize academic writes or child resources (terms/classes).

## Table `academic_years` (frozen)

| Column       | Type        | Constraints                                                  |
| ------------ | ----------- | ------------------------------------------------------------ |
| `id`         | uuid        | PK                                                           |
| `tenant_id`  | uuid        | NOT NULL, FK → `tenants(id)`                                 |
| `name`       | text        | NOT NULL; length 1–200                                       |
| `code`       | text        | NULL; unique per tenant when present                         |
| `starts_on`  | date        | NULL (optional)                                              |
| `ends_on`    | date        | NULL (optional); CHECK when both set: `ends_on >= starts_on` |
| `status`     | text        | NOT NULL; CHECK ∈ `draft`, `active`, `closed`                |
| `created_at` | timestamptz | NOT NULL, default now()                                      |
| `updated_at` | timestamptz | NOT NULL, default now()                                      |

### Indexes

- `uq_academic_years_tenant_code` UNIQUE (`tenant_id`, `code`) WHERE `code IS NOT NULL`
- `ix_academic_years_tenant_status` (`tenant_id`, `status`)
- `ix_academic_years_tenant_starts_on` (`tenant_id`, `starts_on` DESC NULLS LAST)

### List order (keyset)

`starts_on DESC NULLS LAST, id ASC` — newest / dated years first; undated drafts last.

### RLS

- FORCE RLS Pattern A (`tenant_id = app.current_tenant_id()`)
- `educore_app`: **SELECT only** on table
- INSERT/UPDATE/DELETE for app role: **REVOKED** on table
- Product create via SECURITY DEFINER `app.create_academic_year` (rev 1.1)
- Platform role may have INSERT/UPDATE for seed/ops (not product HTTP)

### Write helper (rev 1.1)

`app.create_academic_year(actor, tenant, id, name, code, starts_on, ends_on, status)`  
SECURITY DEFINER; re-checks active membership; GRANT EXECUTE to `educore_app`.

### Ownership

Bounded context: **Academic Structure**. Other modules must not write this table (ADR-001).

## Permission seed (catalog)

| Code              | Description                                                  |
| ----------------- | ------------------------------------------------------------ |
| `academic.read`   | List/view academic structure in tenant                       |
| `academic.manage` | Create/manage academic structure (create year in IMP-003-P2) |

System role posture:

| Role  | `academic.read` | `academic.manage` |
| ----- | --------------- | ----------------- |
| owner | yes             | yes               |
| admin | yes             | yes               |
| staff | yes             | **no**            |

## Exclusions

- terms, classes, streams, subjects, enrollments
- Cross-BC FKs from students
- PATCH/DELETE product HTTP

## Acceptance (solo-operator)

| Role                         | Status | Date       |
| ---------------------------- | ------ | ---------- |
| Database Architect (acting)  | Signed | 2026-07-20 |
| Security (acting)            | Signed | 2026-07-20 |
| Principal Architect (acting) | Signed | 2026-07-20 |

## Related

- Companion: [ACF-003-academic-years-list-slice.md](../api-contract-freeze/ACF-003-academic-years-list-slice.md)
- Implementation: IMP-003-P0 academic years list read
- Pattern twin: [DBF-002-student-registry-list-slice.md](./DBF-002-student-registry-list-slice.md)
