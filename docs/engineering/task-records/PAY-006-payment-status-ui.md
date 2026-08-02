# PAY-006 — Payment status UI (bursar pending MoMo + refresh)

| Field     | Value                                     |
| --------- | ----------------------------------------- |
| Program   | **PAY-006** / EPIC-PAY-01                 |
| Date      | 2026-08-02                                |
| Status    | **Done** (solo-operator)                  |
| Depends   | PAY-005 Done · ACF-012 ≥1.7 · DSF-004 1.5 |
| Authority | Solo-operator provisional (SOLO-GOV-001)  |

## Discovery (U0)

- GET invoice payments / GET payment expose `providerCode` + `providerRef` (BillPay stored as `providerRef`).
- `billPayNumber` only on create mobile-money response — UI uses `billPayDisplay()` (create field first, else `providerRef`).
- Reconcile remains compare-only; Sync uses `POST …/sync-provider`.

## Delivered

- DSF-004 **v1.5** — pending MoMo, BillPay, Sync vs Reconcile, Fake honesty
- Invoice detail: method labels, pending chip, BillPay mono, **Refresh from provider**, **Request mobile money**, office cash unchanged
- Fees hub: **Sync pending (tenant)** → `sync-provider-pending` (limit 25)
- Helpers: `canSyncProviderPayment`, `paymentMethodLabel`, `syncProviderDetailLabel`, `billPayDisplay`, `canFinanceManage` / `canFinanceReconcile`
- Unit tests for helpers

## Manual QA (Fake)

1. Issued invoice with balance → office cash still records receipt.
2. Request mobile money under Fake → 501 banner; form disabled after; no fake success.
3. Pending MoMo (if seeded) shows BillPay from `providerRef`; Refresh under Fake → honest banner.
4. Reconcile button still says compare-only; separate from Refresh.

## Doubt checks

| Question                                   | Answer                       |
| ------------------------------------------ | ---------------------------- |
| See pending MoMo without Sync?             | Yes — status + BillPay       |
| Refresh calls sync-provider not reconcile? | Yes                          |
| Fake honest?                               | Yes — NOT_IMPLEMENTED banner |
| Office cash unchanged?                     | Yes                          |
| Parent pay UI?                             | No                           |

## Next

Pilot secrets/ops **or** EPIC-COMMS — not both as silent scope creep. Optional: OpenAPI ACF-012 catch-up for MoMo/sync paths.
