# PAY-003 — ClickPesa provider client + port

| Field     | Value                                      |
| --------- | ------------------------------------------ |
| Program   | **PAY-003** / EPIC-PAY-01                  |
| Date      | 2026-07-31                                 |
| Status    | **Ready to start**                         |
| Depends   | PAY-002 Accepted                           |
| Contract  | `docs/engineering/decisions/PAY-002-clickpesa-adapter-contract.md` |
| Authority | Solo-operator provisional (SOLO-GOV-001)   |

## Goal

Implement `ClickPesaPaymentProvider` behind `PAYMENT_PROVIDER_PORT`: JWT token cache, create Order BillPay control number, optional `queryStatus`, major↔minor conversion, unit tests with mocked HTTP. Default binding remains Fake.

## Non-goals

Public webhook route (PAY-004); reconcile worker (PAY-005); parent UI.
