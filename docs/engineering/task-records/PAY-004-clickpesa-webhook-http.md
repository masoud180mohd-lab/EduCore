# PAY-004 — ClickPesa webhook + mobile-money initiate HTTP

| Field     | Value                                      |
| --------- | ------------------------------------------ |
| Program   | **PAY-004** / EPIC-PAY-01                  |
| Date      | 2026-07-31                                 |
| Status    | **Ready to start**                         |
| Depends   | PAY-003 Done                               |
| Contract  | PAY-002 + ACF-012 rev 1.5 preview          |
| Authority | Solo-operator provisional (SOLO-GOV-001)   |

## Goal

Ship `POST /api/v1/payments/webhooks/clickpesa` (HMAC-SHA256 checksum, no session) and `POST /api/v1/payments/mobile-money` (finance.manage + Idempotency-Key) that creates a `mobile_money` attempt and returns `billPayNumber`. Complete pending attempts on `PAYMENT RECEIVED` after amount match; amend ACF-012 OpenAPI when live.

## Non-goals

Reconcile job (PAY-005); parent UI; enabling ClickPesa in CI.
