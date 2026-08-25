# IMP-055 — Student portal Phase 4a (DSF-009)

| Field | Value |
|-------|--------|
| Status | **Done (lab)** |
| Date | 2026-08-21 |
| Freeze | `DSF-009-student-portal.md` |
| Spec | `SPEC-PORTALS-001` Phase 4 / `SRS-PORTALS-001-student-portal-amendment.md` |

## Delivered

- Migration `20260821120000_student_portal_bind`: `students.user_id`, `student` system role, `student.self.read`, `app.bind_student_user` / `unbind_student_user`, `assign_system_role_codes` includes `student`.
- API: `GET /api/v1/me/student` (`StudentSelfController`).
- Web: Digii `StudentShell` + `/t/:tenantId/student` home; routing/workspace prefer student after parent.
- Seed: `npm run seed:student-demo` (`SEED_STUDENT_PASS`).

## Deferred (later 4b+)

- Attendance / results / fees self BFF
- Admin bind UI
- Timetable (SPEC Q3 excluded)

## Verify

- Web unit tests (auth preference / workspace)
- API system-roles + grant-reconcile tests
- Manual: migrate → seed:admin → seed:student-demo → login as student → `/student`
