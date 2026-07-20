-- Reverse IMP-003 P3 / DBF-004 terms list-read.

DROP POLICY IF EXISTS rls_terms_update_platform ON terms;
DROP POLICY IF EXISTS rls_terms_insert_platform ON terms;
DROP POLICY IF EXISTS rls_terms_select_platform ON terms;
DROP POLICY IF EXISTS rls_terms_select ON terms;

DROP TABLE IF EXISTS terms;
