# PAY-005 — ClickPesa reconciliation query job

| Field     | Value                                      |
| --------- | ------------------------------------------ |
| Program   | **PAY-005** / EPIC-PAY-01                  |
| Date      | 2026-08-02                                 |
| Status    | **Ready to start**                         |
| Depends   | PAY-004 Done                               |
| Authority | Solo-operator provisional (SOLO-GOV-001)   |

## Goal

Reconcile pending `clickpesa` payment attempts via `GET /payments/{orderReference}` independently of webhooks (bible): detect amount/status mismatches, complete delayed SUCCESS, never double-post ledger.

## Non-goals

Parent UI; Selcom; enabling ClickPesa in CI by default.
