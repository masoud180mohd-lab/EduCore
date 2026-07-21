# IMP-005-A0 — Attendance schema + freezes

| Field     | Value                     |
| --------- | ------------------------- |
| Program   | IMP-005 Attendance        |
| Increment | A0                        |
| Date      | 2026-07-21                |
| Authority | Solo-operator provisional |

## Discovery

- **Students:** `GET/POST/PATCH /api/v1/students` — green on main (IMP-002).
- **Academic:** years, terms, classes, streams — green (IMP-003).
- **Enrollments:** `GET/POST/PATCH /api/v1/enrollments` with active status filter — green (IMP-004).
- **Attendance module:** skeleton only; no product routes.

Enrollment dependency satisfied — proceed.

## Delivered

- `DBF-009-attendance-slice.md` — `attendance_sessions`, `attendance_records`, RLS Pattern A, SELECT-only app grants.
- `ACF-009-attendance-slice.md` — full endpoint matrix rev 1.3.
- Migration `20260721010000_attendance_sessions_records` — tables, indexes, permissions seed (`attendance.read`, `attendance.manage` on owner/admin/staff).
- Migration `20260721020000_attendance_write_helpers` — `create_attendance_session`, `close_attendance_session`, `upsert_attendance_record` (enrollment-gated).
- `AttendanceSessionsRepository` — SELECT + helper calls (not yet wired to HTTP).

## Doubt checks

| Probe                          | Result                                       |
| ------------------------------ | -------------------------------------------- |
| Mark non-enrolled student      | Blocked in `upsert_attendance_record` helper |
| Cross-tenant classId on create | `class not found` (22023)                    |
| GET session other-tenant id    | RLS → 404 at service                         |

## Verification

- `npm run check` — pending HTTP wiring in A1+.
