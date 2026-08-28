-- F-016 down: remove tenant SELECT policy and disable FORCE/ENABLE RLS.

DROP POLICY IF EXISTS rls_payment_reconciliations_select ON payment_reconciliations;

ALTER TABLE payment_reconciliations NO FORCE ROW LEVEL SECURITY;
ALTER TABLE payment_reconciliations DISABLE ROW LEVEL SECURITY;
