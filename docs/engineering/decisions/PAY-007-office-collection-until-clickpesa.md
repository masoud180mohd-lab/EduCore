# PAY-007 — Office collection until ClickPesa is affordable

| Field       | Value                                                                           |
| ----------- | ------------------------------------------------------------------------------- |
| Decision ID | `PAY-007`                                                                       |
| Status      | **Accepted** (Owner + AI, SOLO-GOV-002)                                         |
| Date        | 2026-08-13                                                                      |
| Amends      | PAY-001 / PAY-PROVIDER-001 (vendor **choice** unchanged; **live path** changes) |
| Authority   | Project Owner                                                                   |

## Context

Owner cannot pay to open a ClickPesa (or Selcom) merchant account now. F-001 was blocking as if keys were the next required step. They are not, if the school collects at the office.

## Decision

1. **Live collection path:** office **cash / bank / cheque / other** (`app.post_manual_payment`). This is real money, ledger-true, no vendor account.
2. **ClickPesa** remains the chosen MoMo vendor for later. Do not invent keys. Do not switch to Selcom/Pesapal/Flutterwave just to have “another logo” — those also need paid/KYC accounts.
3. **Fake** stays CI / lab simulation only. It is not a parent-facing wallet.
4. **F-001** is **deferred**, not a close. Resume PAY-OPS-001 when Owner can afford vendor onboarding.
5. Parent UX stays “pay at the school office.” Admin MoMo request stays disabled until `PAYMENT_PROVIDER=clickpesa` with secrets.

## What this is not

- Not a claim that MoMo works.
- Not a second aggregator adapter.
- Not permission to fake ClickPesa webhooks in production as if parents paid Mixx/M-Pesa.
