# F-016: RLS on `payment_reconciliations`

## Outcome

Close Board finding **F-016**: `payment_reconciliations` had `GRANT SELECT` to `educore_app` without ENABLE/FORCE RLS, so a runtime connection could read every tenant's reconcile audit rows.

## Status

Complete for the SELECT isolation gap. F-017 (SECURITY DEFINER MoMo helpers) is out of scope.

## Resolution

| Item | Change |
| --- | --- |
| RLS | `app.enable_tenant_rls('payment_reconciliations')` |
| Policy | `rls_payment_reconciliations_select` FOR SELECT TO `educore_app` USING `tenant_id = app.current_tenant_id()` |
| PUBLIC | `REVOKE ALL` (aligned with other finance tables) |
| Evidence | Live test: tenant A context cannot SELECT tenant B rows; unset GUC sees none |

## Files

- `apps/api/db/migrations/20260813150000_payment_reconciliations_rls.up.sql` / `.down.sql`
- `tests/isolation/payment-reconciliations.live.test.ts`
- `tests/tooling/imp009-finance-fees.test.ts`
- `docs/engineering/database-freeze/DBF-012-finance-fees-slice.md` (rev 1.4)

## Verification

```bash
npx vitest run tests/tooling/imp009-finance-fees.test.ts tests/isolation/payment-reconciliations.live.test.ts
# With Docker Postgres:
npm run docker:up
npm run db:migrate
```
