-- F-016: ENABLE + FORCE RLS on payment_reconciliations (missed in 20260721160400).
-- Policy matches other finance tables: educore_app SELECT scoped to app.current_tenant_id().
-- Writes remain SECURITY DEFINER (app.reconcile_payment); educore_app stays SELECT-only.

REVOKE ALL ON TABLE payment_reconciliations FROM PUBLIC;

SELECT app.enable_tenant_rls('payment_reconciliations'::regclass);

DROP POLICY IF EXISTS rls_payment_reconciliations_select ON payment_reconciliations;
CREATE POLICY rls_payment_reconciliations_select ON payment_reconciliations
  FOR SELECT TO educore_app
  USING (tenant_id = app.current_tenant_id());
