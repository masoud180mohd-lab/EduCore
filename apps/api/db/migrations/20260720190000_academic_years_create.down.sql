DELETE FROM role_permissions
WHERE permission_id IN (SELECT id FROM permissions WHERE code = 'academic.manage');

DELETE FROM permissions WHERE code = 'academic.manage';

DROP FUNCTION IF EXISTS app.create_academic_year(uuid, uuid, uuid, text, text, date, date, text);
