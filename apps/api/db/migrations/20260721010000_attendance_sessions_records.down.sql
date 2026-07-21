DELETE FROM role_permissions
WHERE permission_id IN (
  SELECT id FROM permissions WHERE code IN ('attendance.read', 'attendance.manage')
);
DELETE FROM permissions WHERE code IN ('attendance.read', 'attendance.manage');

DROP POLICY IF EXISTS rls_attendance_records_update_platform ON attendance_records;
DROP POLICY IF EXISTS rls_attendance_records_insert_platform ON attendance_records;
DROP POLICY IF EXISTS rls_attendance_records_select_platform ON attendance_records;
DROP POLICY IF EXISTS rls_attendance_records_select ON attendance_records;

DROP POLICY IF EXISTS rls_attendance_sessions_update_platform ON attendance_sessions;
DROP POLICY IF EXISTS rls_attendance_sessions_insert_platform ON attendance_sessions;
DROP POLICY IF EXISTS rls_attendance_sessions_select_platform ON attendance_sessions;
DROP POLICY IF EXISTS rls_attendance_sessions_select ON attendance_sessions;

DROP TABLE IF EXISTS attendance_records;
DROP TABLE IF EXISTS attendance_sessions;
