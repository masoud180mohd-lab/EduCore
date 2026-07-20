# Database Freeze — Student Registry List Slice (DBF-002)

## Freeze status

| Field               | Value                                                                            |
| ------------------- | -------------------------------------------------------------------------------- |
| Freeze ID           | `DBF-002`                                                                        |
| Title               | Database Freeze — Student Registry list-read slice                               |
| Version             | `1.1` (v1.0 list-read; rev 1.1 create helper)                                    |
| Date                | 2026-07-20                                                                       |
| Authority           | Solo-operator provisional acceptance (SOLO-GOV-001)                              |
| Engine              | PostgreSQL                                                                       |
| Scope               | Student Registry — `students` table (list/detail read + create write path)       |
| Explicitly excluded | Guardians, admissions, enrollments, attendance, marks, academic class/stream FKs |

**Honesty qualifier:** Accepted under solo-operator acting seats — **not** independent multi-person external review.

## Purpose

Authorize the **smallest** tenant-owned schema for student list/detail reads (ACF-002) and **create** via controlled helper (ACF-002 rev 1.2 / IMP-002-P2).

Does **not** authorize PATCH/DELETE students, guardians, or Academic Structure joins.

## Revision history

| Version | Date       | Notes                                                                                                  |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------ |
| 1.0     | 2026-07-20 | Table + SELECT-only for `educore_app`                                                                  |
| **1.1** | 2026-07-20 | `app.create_student` SECURITY DEFINER; `student.manage` permission; table INSERT stays revoked for app |

## Table `students` (frozen)

| Column         | Type        | Constraints                                                                 |
| -------------- | ----------- | --------------------------------------------------------------------------- |
| `id`           | uuid        | PK                                                                          |
| `tenant_id`    | uuid        | NOT NULL, FK → `tenants(id)`                                                |
| `student_code` | text        | NULL; unique per tenant when present                                        |
| `display_name` | text        | NOT NULL; length 1–200                                                      |
| `status`       | text        | NOT NULL; CHECK ∈ `active`, `inactive`, `graduated`, `transferred`, `draft` |
| `created_at`   | timestamptz | NOT NULL, default now()                                                     |
| `updated_at`   | timestamptz | NOT NULL, default now()                                                     |

**Name model (v1):** single `display_name` only (parity with users list simplicity).  
**Deferred PII:** `date_of_birth`, national IDs, guardian links — not in this freeze.

### Indexes

- `uq_students_tenant_code` UNIQUE (`tenant_id`, `student_code`) WHERE `student_code IS NOT NULL`
- `ix_students_tenant_status` (`tenant_id`, `status`)
- `ix_students_tenant_display_name` (`tenant_id`, `display_name`)

### RLS

- FORCE RLS Pattern A (tenant isolation via `app.current_tenant_id()`)
- `educore_app`: **SELECT only** on table (INSERT/UPDATE/DELETE remain **REVOKED**)
- Product create (rev 1.1): SECURITY DEFINER `app.create_student(...)` + `GRANT EXECUTE` to `educore_app`
- Helper re-checks `app.auth_has_active_membership(actor, tenant)` and forces `tenant_id = p_tenant_id`
- Platform role may have INSERT/UPDATE for seed/ops (not product HTTP)

### Ownership

Bounded context: **Student Registry**. Other modules must not write this table (ADR-001).

## Permission seed (catalog)

| Code             | Description                                                              |
| ---------------- | ------------------------------------------------------------------------ |
| `student.read`   | List/view students in tenant                                             |
| `student.manage` | Create students in tenant (this slice: create only; no PATCH/DELETE yet) |

System role posture:

| Role  | `student.read` | `student.manage`       |
| ----- | -------------- | ---------------------- |
| owner | yes            | yes (full catalogue)   |
| admin | yes            | yes                    |
| staff | yes            | **NO** (read-oriented) |

## Exclusions (must not appear in this freeze migrations)

- Guardians, admissions, enrollments, attendance, assessment, finance
- Cross-BC FKs to academic classes/years
- Soft-delete columns beyond status enum

## Acceptance (solo-operator)

| Role                         | Status | Date       |
| ---------------------------- | ------ | ---------- |
| Database Architect (acting)  | Signed | 2026-07-20 |
| Security (acting)            | Signed | 2026-07-20 |
| Principal Architect (acting) | Signed | 2026-07-20 |

## Related

- Companion: [ACF-002-student-registry-list-slice.md](../api-contract-freeze/ACF-002-student-registry-list-slice.md)
- Implementation: IMP-002-P0 students list read
