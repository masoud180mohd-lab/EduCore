# Database Freeze — Marks / Assessment slice (DBF-011)

| Field     | Value                                    |
| --------- | ---------------------------------------- |
| Freeze ID | `DBF-011`                                |
| Version   | `1.0`                                    |
| Date      | 2026-07-21                               |
| Companion | ACF-011                                  |
| Authority | Solo-operator provisional (SOLO-GOV-001) |

## Tables

### `exams`

| Column                  | Type                     | Notes                         |
| ----------------------- | ------------------------ | ----------------------------- |
| id                      | uuid PK                  |                               |
| tenant_id               | uuid FK → tenants        | RLS                           |
| name                    | text 1–200               |                               |
| academic_year_id        | uuid FK → academic_years |                               |
| term_id                 | uuid NULL FK → terms     |                               |
| class_id                | uuid FK → classes        | roster scope                  |
| status                  | text                     | `draft` \| `open` \| `closed` |
| created_by_user_id      | uuid NULL                |                               |
| created_at / updated_at | timestamptz              |                               |

### `exam_subjects`

| Column                  | Type               | Notes                                |
| ----------------------- | ------------------ | ------------------------------------ |
| id                      | uuid PK            |                                      |
| tenant_id               | uuid FK            | RLS                                  |
| exam_id                 | uuid FK → exams    |                                      |
| subject_id              | uuid FK → subjects |                                      |
| max_score               | numeric(8,2)       | > 0, ≤ 9999.99                       |
| status                  | text               | `draft` \| `submitted` \| `approved` |
| created_at / updated_at | timestamptz        |                                      |

Unique `(exam_id, subject_id)`.

### `marks`

| Column                  | Type                    | Notes                |
| ----------------------- | ----------------------- | -------------------- |
| id                      | uuid PK                 |                      |
| tenant_id               | uuid FK                 | RLS                  |
| exam_subject_id         | uuid FK → exam_subjects |                      |
| student_id              | uuid FK → students      |                      |
| score                   | numeric(8,2) NULL       | 0…max_score when set |
| note                    | text NULL               | ≤ 500                |
| marked_by_user_id       | uuid NULL               |                      |
| created_at / updated_at | timestamptz             |                      |

Unique `(exam_subject_id, student_id)`.

## Privileges

- `educore_app`: SELECT only; writes via SECURITY DEFINER helpers
- Helpers require active membership
- Upsert marks: student must have **active** enrollment for exam.class_id

## Permissions

- `marks.read` — owner, admin, staff
- `marks.manage` — owner, admin, staff (create exam/subject, upsert, submit)
- `marks.approve` — owner, admin only

## Non-goals

- `marks_submissions` / `marks_approvals` audit tables (status on `exam_subjects` is enough for v1)
- `report_cards` generation
- `teacher_assignments` gating

## Solo-operator honesty

Provisional for IMP-008.
