# Database Freeze — Attendance (DBF-009)

| Field | Value |
| ----- | ----- |
| Freeze ID | `DBF-009` |
| Version | `1.1` (1.0 tables; 1.1 write helpers) |
| Date | 2026-07-21 |
| Authority | Solo-operator provisional (SOLO-GOV-001) |

## Tables

### `attendance_sessions`

class_id, optional stream_id, academic_year_id, term_id, session_date, status open|closed, notes, created_by_user_id.  
Unique: (tenant, class, coalesce(stream), session_date). Pattern A RLS; educore_app SELECT only.

### `attendance_records`

session_id, student_id, status present|absent|late|excused, note, marked_at, marked_by_user_id.  
Unique (session_id, student_id). Pattern A RLS; educore_app SELECT only.

## Helpers

- `app.create_attendance_session`
- `app.close_attendance_session`
- `app.upsert_attendance_record` (requires **active** enrollment for session class)

## Permissions

`attendance.read`, `attendance.manage` — owner, admin, **staff** (both).
