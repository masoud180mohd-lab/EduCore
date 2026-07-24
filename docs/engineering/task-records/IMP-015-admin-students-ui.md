# IMP-015 — Admin Students create + edit

| Field     | Value                             |
| --------- | --------------------------------- |
| Program   | **IMP-015**                       |
| Date      | 2026-07-25                        |
| Authority | Solo-operator provisional         |
| Contracts | ACF-002 (unchanged); DSF-002 v1.4 |

## Goal

Admin UI to create and edit students against existing Nest HTTP (no new student DELETE).

## Waves

| Wave | Work                                 | Status |
| ---- | ------------------------------------ | ------ |
| 0    | DSF-002 amend + this record          | Done   |
| 1    | List links + create form             | Done   |
| 2    | Detail edit PATCH                    | Done   |
| 3    | Tooling + manual QA + check + commit | Done   |

## Routes

- `/t/[tenantId]/admin/students` — list + create
- `/t/[tenantId]/admin/students/[studentId]` — detail + edit

## Manual QA

Checklist: `tasks/manual-test-admin-students-qa.md`

## Non-goals

- Student DELETE
- Settings / Users / Orgs / MoMo
- Enrollment transfer
