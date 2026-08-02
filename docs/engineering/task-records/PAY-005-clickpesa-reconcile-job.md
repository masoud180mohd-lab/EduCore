# PAY-005 — ClickPesa reconciliation query job

| Field     | Value                                    |
| --------- | ---------------------------------------- |
| Program   | **PAY-005** / EPIC-PAY-01                |
| Date      | 2026-08-02                               |
| Status    | **Done** (solo-operator)                 |
| Depends   | PAY-004 Done                             |
| Contract  | PAY-002 + ACF-012 rev **1.7**            |
| Authority | Solo-operator provisional (SOLO-GOV-001) |

## Delivered

- `POST /api/v1/payments/{id}/sync-provider` (`finance.reconcile` + Idempotency-Key)
- `POST /api/v1/payments/sync-provider-pending` (batch; `{ limit? }` 1–100)
- `PaymentAttemptsRepository.listPendingClickPesa`
- `queryStatus` maps `collectedAmount` → `amountMinor` + `providerEventId`
- Ingest reuses `ingest_clickpesa_gateway_event` (no double-post)
- Unit tests for sync / still_pending / Fake `NOT_IMPLEMENTED`

## Next

**PAY-006** — payment status UI (bursar refresh). Operator: sandbox secrets + MoMo migration if not yet applied.
