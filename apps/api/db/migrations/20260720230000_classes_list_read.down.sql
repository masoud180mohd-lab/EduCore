-- Reverse IMP-003-C0 / DBF-005 classes list-read.

DROP POLICY IF EXISTS rls_classes_update_platform ON classes;
DROP POLICY IF EXISTS rls_classes_insert_platform ON classes;
DROP POLICY IF EXISTS rls_classes_select_platform ON classes;
DROP POLICY IF EXISTS rls_classes_select ON classes;

DROP TABLE IF EXISTS classes;
