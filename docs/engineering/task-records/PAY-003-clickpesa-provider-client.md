# PAY-003 — ClickPesa provider client + port

| Field     | Value                                                              |
| --------- | ------------------------------------------------------------------ |
| Program   | **PAY-003** / EPIC-PAY-01                                          |
| Date      | 2026-07-31                                                         |
| Status    | **Done** (solo-operator)                                           |
| Depends   | PAY-002 Accepted                                                   |
| Contract  | `docs/engineering/decisions/PAY-002-clickpesa-adapter-contract.md` |
| Authority | Solo-operator provisional (SOLO-GOV-001)                           |

## Goal

Implement `ClickPesaPaymentProvider` behind `PAYMENT_PROVIDER_PORT` with Fake remaining the default.

## Delivered

| Piece              | Path                                                                          |
| ------------------ | ----------------------------------------------------------------------------- |
| Money + status map | `apps/api/src/modules/payments/providers/clickpesa-money.ts`                  |
| Env config         | `clickpesa-config.ts`                                                         |
| HTTP + JWT cache   | `clickpesa-http.client.ts`                                                    |
| Port impl          | `clickpesa-payment.provider.ts`                                               |
| Module binding     | `payments.module.ts` — Fake unless `PAYMENT_PROVIDER=clickpesa` + secrets     |
| Tests              | `clickpesa-money.test.ts`, `clickpesa-payment.provider.test.ts` (mocked HTTP) |
| Env placeholders   | root `.env.example`                                                           |

## Verify

```bash
npx vitest run apps/api/src/modules/payments/providers/clickpesa-*.test.ts
npx tsc --noEmit -p apps/api/tsconfig.json
```

## Non-goals (next)

- Public webhook route → **PAY-004**
- Reconcile worker → **PAY-005**
- Parent/admin MoMo UI
