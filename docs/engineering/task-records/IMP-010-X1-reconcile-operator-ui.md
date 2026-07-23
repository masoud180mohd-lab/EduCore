# IMP-010-X1 — Reconcile operator UI

| Field   | Value                                  |
| ------- | -------------------------------------- |
| Program | **IMP-010** Wave X1                    |
| Date    | 2026-07-23                             |
| API     | `POST /api/v1/payments/{id}/reconcile` |
| AuthZ   | `finance.reconcile` (ACF-012)          |
| Design  | DSF-004 amended (reconcile in-scope)   |

## Outcome

Operator can run **compare-only** payment reconcile from:

- Invoice detail → each payment row (**Reconcile**)
- Receipt detail → linked payment (**Reconcile payment**)

UI displays outcome (`matched` | `amount_mismatch` | `missing_event` | `status_mismatch`) and amounts. **Does not claim ledger or balance mutation.**

## Explicit non-goals

- Fake webhook console (Wave X2 still skipped)
- MoMo / PAY-PROVIDER-001
- Nest API changes

## Verification

```bash
npm run check
```

## Manual

1. As owner/admin with `finance.reconcile`: open issued invoice with a payment → Reconcile.
2. Expect banner with outcome (office cash often `No gateway event`).
3. User without reconcile permission → “You do not have finance reconcile access.”
