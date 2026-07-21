-- Down: IMP-008 marks assessment tables.

DELETE FROM role_permissions
WHERE permission_id IN (
  SELECT id FROM permissions WHERE code IN ('marks.read', 'marks.manage', 'marks.approve')
);
DELETE FROM permissions WHERE code IN ('marks.read', 'marks.manage', 'marks.approve');

DROP TABLE IF EXISTS marks;
DROP TABLE IF EXISTS exam_subjects;
DROP TABLE IF EXISTS exams;
