# F-017: MoMo SECURITY DEFINER EXECUTE split

## Outcome

Close Board finding **F-017**: `educore_app` had `EXECUTE` on `complete_pending_mobile_money_payment` and `ingest_clickpesa_gateway_event` (SECURITY DEFINER, no membership). A leaked app-role connection could complete pending MoMo payments without HMAC.

## Status

Complete for the EXECUTE split. HMAC remains an HTTP control. F-008 write-isolation coverage is out of scope.

## Resolution

| Item | Change |
| --- | --- |
| `complete_pending_mobile_money_payment` | REVOKE EXECUTE from `educore_app` and `educore_webhook` (ingest calls it as definer) |
| `ingest_clickpesa_gateway_event` | REVOKE from `educore_app`; GRANT to `educore_webhook` |
| Nest | Dedicated `PG_WEBHOOK_POOL` (`EDUCORE_WEBHOOK_DATABASE_URL` or local default when `EDUCORE_ENABLE_APP_DB=1`) |
| Evidence | Live tests: app role EXECUTE denied; webhook role can call ingest, not complete |

## Files

- `apps/api/db/migrations/20260813160000_momo_webhook_role_grants.up.sql` / `.down.sql`
- `apps/api/db/bootstrap/001_roles.sql`
- `apps/api/src/common/persistence/*` webhook pool
- `apps/api/src/modules/payments/repositories/payment-attempts.repository.ts`
- `tests/isolation/momo-secdefiner.live.test.ts`

## Verification

```bash
npx vitest run tests/tooling/migration-tooling.test.ts apps/api/src/common/persistence/database-config.test.ts tests/isolation/momo-secdefiner.live.test.ts
```
