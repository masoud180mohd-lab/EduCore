# Manual QA — IMP-010 Admin Fees UI

Prerequisites: API on `:3000`, web on `:3001`, migrated DB, local admin with `finance.read` / `finance.manage`.

```bash
npm run db:migrate
npm run rbac:reconcile-grants
npm run start:dev
npm run dev:web
```

## Happy path

1. Login as owner/admin → Admin home → **Fees**.
2. **Structures** → create structure for an academic year with ≥1 item (e.g. Tuition `150000.00` TZS major).
3. Open structure detail → items and amounts display as `TZS x.xx`.
4. **Invoices** → create draft for a student + year + that structure (or manual line).
5. Invoice detail → **Issue** → status issued; balance = total (derived).
6. **Record office payment** (cash) for full or partial amount ≤ balance.
7. Confirm receipt link → **Receipts** list and detail.
8. If partial: pay remainder; status → paid; balance `TZS 0.00`.

## Negative / edge

| Case                       | Expect                                                 |
| -------------------------- | ------------------------------------------------------ |
| Overpay (amount > balance) | Client blocks before POST                              |
| Pay while draft            | Pay form hidden; Issue first                           |
| Void after payment         | Void disabled when balance < total / not issued unpaid |
| Void unpaid issued         | Confirm → void; balance 0                              |
| Reverse succeeded payment  | Confirm → reversed; invoice balance restored           |
| Double-click pay           | Same Idempotency-Key → safe replay                     |
| User without finance.*     | Lists show “You do not have finance access.”           |
| Mobile money               | Note only; no MoMo method in office form               |

## Residual

- No Playwright e2e in CI for this program.
- Reconcile / Fake webhook UI not in MVP (Wave X).
- MoMo blocked (PAY-PROVIDER-001).
