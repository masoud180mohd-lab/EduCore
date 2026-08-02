# PAY-004 — ClickPesa webhook + mobile-money initiate HTTP

| Field     | Value                                      |
| --------- | ------------------------------------------ |
| Program   | **PAY-004** / EPIC-PAY-01                  |
| Date      | 2026-08-02                                 |
| Status    | **Done** (solo-operator)                   |
| Depends   | PAY-003 Done                               |
| Contract  | PAY-002 + ACF-012 rev **1.6**              |
| Authority | Solo-operator provisional (SOLO-GOV-001)   |

## Delivered

- `POST /api/v1/payments/mobile-money` (finance.manage + Idempotency-Key)
- `POST /api/v1/payments/webhooks/clickpesa` (HMAC-SHA256, no session)
- Migration `20260802150000_finance_clickpesa_momo`
- Checksum helper + unit tests
- Fake remains CI default

## Next

**PAY-005** — reconciliation via ClickPesa query API (**Done**).
