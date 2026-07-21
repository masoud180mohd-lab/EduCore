# Database Freeze — Enrollments (DBF-008)

## Freeze status

| Field               | Value                                                                 |
| ------------------- | --------------------------------------------------------------------- |
| Freeze ID           | `DBF-008`                                                             |
| Title               | Database Freeze — enrollments (list + create + status update helpers) |
| Version             | `1.2` (1.0 list table; 1.1 create helper; 1.2 update_status helper)   |
| Date                | 2026-07-21                                                            |
| Authority           | Solo-operator provisional acceptance (SOLO-GOV-001)                   |
| Engine              | PostgreSQL                                                            |
| Scope               | Academic Structure owns `enrollments` table + write helpers           |
| Explicitly excluded | Attendance, marks, bulk import, nested expansions, guardians          |

**Honesty qualifier:** Solo-operator provisional — not multi-party external review.

## Purpose

Authorize tenant-owned enrollment of a student into a class (optional stream), with lifecycle status, for product HTTP under ACF-008.

## Parent dependencies

| Table          | Freeze  |
| -------------- | ------- |
| students       | DBF-002 |
| classes        | DBF-005 |
| streams        | DBF-006 |
| academic_years | DBF-003 |
| terms          | DBF-004 |

## Table `enrollments` (frozen)

| Column             | Type        | Constraints                                                           |
| ------------------ | ----------- | --------------------------------------------------------------------- |
| `id`               | uuid        | PK                                                                    |
| `tenant_id`        | uuid        | NOT NULL, FK → tenants(id)                                            |
| `student_id`       | uuid        | NOT NULL, FK → students(id)                                           |
| `class_id`         | uuid        | NOT NULL, FK → classes(id)                                            |
| `stream_id`        | uuid        | NULL, FK → streams(id)                                                |
| `academic_year_id` | uuid        | NOT NULL, FK → academic_years(id) (denormalized from class on create) |
| `term_id`          | uuid        | NULL, FK → terms(id) (copied from class.term_id when present)         |
| `status`           | text        | NOT NULL; CHECK ∈ `active`, `withdrawn`, `completed`, `suspended`     |
| `enrolled_at`      | timestamptz | NOT NULL, default now()                                               |
| `created_at`       | timestamptz | NOT NULL, default now()                                               |
| `updated_at`       | timestamptz | NOT NULL, default now()                                               |

### Indexes

- `ix_enrollments_tenant_year_status` (`tenant_id`, `academic_year_id`, `status`)
- `ix_enrollments_tenant_class_status` (`tenant_id`, `class_id`, `status`)
- `ix_enrollments_tenant_student_status` (`tenant_id`, `student_id`, `status`)
- `uq_enrollments_active_suspended` UNIQUE (`tenant_id`, `student_id`, `class_id`, `academic_year_id`)  
  WHERE `status IN ('active', 'suspended')` — prevents double open enrollment same student+class+year

### List order (keyset)

`created_at ASC, id ASC`

### Integrity (writes)

- Helper must ensure student, class (and stream if set) belong to `p_tenant_id`.
- `academic_year_id` / `term_id` derived from class row (not from body).
- If `stream_id` set: stream must have same `tenant_id` and `class_id = p_class_id`.

### RLS

- FORCE RLS Pattern A (`tenant_id = app.current_tenant_id()`)
- `educore_app`: **SELECT only** on table; INSERT/UPDATE/DELETE **REVOKED**
- Product writes via SECURITY DEFINER:
  - `app.create_enrollment` (rev 1.1)
  - `app.update_enrollment_status` (rev 1.2)

### Ownership

Bounded context: **Academic Structure**. student-registry must not write this table.

## Permission

Reuses `academic.read` / `academic.manage` (no new codes in v1).

## Acceptance (solo-operator)

| Role                         | Status | Date       |
| ---------------------------- | ------ | ---------- |
| Database Architect (acting)  | Signed | 2026-07-21 |
| Security (acting)            | Signed | 2026-07-21 |
| Principal Architect (acting) | Signed | 2026-07-21 |

## Related

- Companion: [ACF-008-enrollments-slice.md](../api-contract-freeze/ACF-008-enrollments-slice.md)
- Implementation: IMP-004-E0 … E4
