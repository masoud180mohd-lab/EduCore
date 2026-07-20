DELETE FROM role_permissions
WHERE permission_id IN (SELECT id FROM permissions WHERE code = 'academic.read');

DELETE FROM permissions WHERE code = 'academic.read';

DROP POLICY IF EXISTS rls_academic_years_update_platform ON academic_years;
DROP POLICY IF EXISTS rls_academic_years_insert_platform ON academic_years;
DROP POLICY IF EXISTS rls_academic_years_select_platform ON academic_years;
DROP POLICY IF EXISTS rls_academic_years_select ON academic_years;

DROP TABLE IF EXISTS academic_years;
