DELETE FROM role_permissions rp
USING permissions p
WHERE rp.permission_id = p.id
  AND p.code = 'student.read';

DELETE FROM permissions WHERE code = 'student.read';

DROP POLICY IF EXISTS rls_students_update_platform ON students;
DROP POLICY IF EXISTS rls_students_insert_platform ON students;
DROP POLICY IF EXISTS rls_students_select_platform ON students;
DROP POLICY IF EXISTS rls_students_select ON students;

DROP TABLE IF EXISTS students;
