-- Down: IMP-007-G1 / DBF-010 guardians.

DELETE FROM role_permissions
WHERE permission_id IN (
  SELECT id FROM permissions WHERE code IN ('guardian.read', 'guardian.manage')
);
DELETE FROM permissions WHERE code IN ('guardian.read', 'guardian.manage');

DROP TABLE IF EXISTS student_guardians;
DROP TABLE IF EXISTS guardians;
