# IMP-001 P10 — Live read isolation + HTTP AuthZ + OpenAPI sync (AUDIT-R4 High)

## Outcome

Close AUDIT-R4 **High** backlog items without opening writes:

1. **HTTP integration** — prove `RequirePermission` + session↔header bind on product read routes (CI-safe harness tokens).
2. **Live isolation** — SQL RLS for `organizations` + `tenant_settings`; HTTP matrix with real login when Postgres available.
3. **OpenAPI / ACF amend** — P8 list filters (`orgType`, `search`, `userId`) + `session_tenant_bind` on privileged GET `x-authz` stacks.

## Status

**Complete** (2026-07-20).

## Deliverables

| Area                   | Path                                                                                    |
| ---------------------- | --------------------------------------------------------------------------------------- |
| HTTP AuthZ (always on) | `tests/integration/product-reads-authz.http.test.ts`                                    |
| Harness token          | `tests/integration/harness-token-validator.ts`                                          |
| HTTP client helper     | `tests/integration/http-client.ts`                                                      |
| Live SQL + HTTP        | `tests/isolation/product-reads.live.test.ts`                                            |
| OpenAPI                | `acf-001-identity-tenant.openapi.yaml`                                                  |
| Contract harness       | `tests/contract/openapi-harness.test.ts`, `tests/tooling/p10-openapi-read-sync.test.ts` |

## Verification

```bash
npm run check

# Optional live matrix (Postgres + seed):
$env:RUN_LIVE_DB_TESTS='1'
$env:SEED_ADMIN_PASS='ChangeMe-Local-Only-1'
$env:EDUCORE_ENABLE_APP_DB='1'
npm test -- tests/isolation/product-reads.live.test.ts
```

## Related

- [AUDIT-R4-read-increments-review.md](./AUDIT-R4-read-increments-review.md)
- [IMP-001-P8-list-pagination-filtering.md](./IMP-001-P8-list-pagination-filtering.md)
- [IMP-001-P5d-tenants-warn-log-openapi.md](./IMP-001-P5d-tenants-warn-log-openapi.md)
