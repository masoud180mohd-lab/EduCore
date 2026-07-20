DELETE FROM role_permissions rp
USING permissions p
WHERE rp.permission_id = p.id
  AND p.code = 'student.manage';

DELETE FROM permissions WHERE code = 'student.manage';

DROP FUNCTION IF EXISTS app.create_student(uuid, uuid, uuid, text, text, text);
