# SRS amendment — Student portal (Phase 4a)

| Field | Value |
|-------|--------|
| Parent | `SPEC-PORTALS-001` Phase 4 |
| Freeze | `DSF-009-student-portal.md` |
| Date | 2026-08-21 |

## Requirements (shall)

1. System **shall** allow at most one active `users` bind per `students` row (`user_id`).
2. System **shall** expose `GET /api/v1/me/student` requiring `student.self.read`.
3. System **shall** return 404 when the caller has no bound student in the tenant.
4. Web **shall** provide Digii student shell at `/t/:tenantId/student`.
5. Preferential home **shall** route bound students to student home after Head/Admin/Teacher/Parent precedence.

## Non-requirements (4a)

- Self attendance/results/fees APIs; timetable; student write paths.
