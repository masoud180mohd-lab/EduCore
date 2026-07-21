# IMP-004 — Enrollments program (E0–E4)

## Outcome

Student ↔ class enrollment API under Academic Structure: list, detail, create, patch status.

## Status

**Complete** (2026-07-21) — dependency for Attendance (IMP-005).

## Freezes

- DBF-008, ACF-008 rev 1.3

## Surfaces

| Method | Path | Permission |
| ------ | ---- | ---------- |
| GET | `/api/v1/enrollments` | academic.read |
| GET | `/api/v1/enrollments/:id` | academic.read |
| POST | `/api/v1/enrollments` | academic.manage |
| PATCH | `/api/v1/enrollments/:id` | academic.manage |

## Migrations

- `20260720290000_enrollments_list_read`
- `20260720300000_enrollments_write_helpers`
