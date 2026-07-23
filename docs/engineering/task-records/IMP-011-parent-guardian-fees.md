# IMP-011 — Parent / Guardian Fees View (read-only)

| Field     | Value                                                       |
| --------- | ----------------------------------------------------------- |
| Program   | **IMP-011**                                                 |
| Date      | 2026-07-23                                                  |
| Path      | **Admin compose** (portal bind missing)                     |
| Design    | [DSF-005](../design-freeze/DSF-005-parent-guardian-fees.md) |
| Contracts | ACF-010 + ACF-012 (no Nest amend)                           |

## Screens delivered

1. Guardian detail → **View fees (read-only)**
2. `/admin/guardians/[guardianId]/fees` — active linked students
3. `.../fees/students/[studentId]` — `GET /invoices?studentId=`
4. `.../fees/invoices/[invoiceId]` — lines, balance, payments (no mutate)
5. `.../fees/receipts/[receiptId]` — receipt + payment (no reconcile)

## Isolation

Client allowlist = active `GET /guardians/{id}/links` studentIds (`guardian-fees-access.ts`).  
Out-of-allowlist student/invoice/receipt → honest block message. Never lists all-tenant invoices.

## Explicit non-goals (still true)

- Real MoMo — **PAY-PROVIDER-001**
- Parent pay / checkout
- Parent portal shell (Wave PX)
- finance.manage / reconcile on this surface

## Verification

```bash
npm run check
```

Tooling: `tests/tooling/imp011-guardian-fees.test.ts`  
Unit: `apps/web/src/lib/finance/guardian-fees-access.test.ts`

## Manual QA

1. Link guardian → student (active).
2. Bursar issues invoice for that student → appears under guardian fees → student invoices.
3. Record office payment → balance drops; payment + receipt visible on read-only invoice/receipt.
4. Open fees for guardian B → must not show guardian A’s student invoices (allowlist).
5. Confirm no Issue / Void / Pay / Reverse / Reconcile on guardian fees pages.
6. Banner: “Pay at the school office. Mobile money is not enabled.”

## Doubt checks

| Check                          | Answer                             |
| ------------------------------ | ---------------------------------- |
| Guardian A see student of B?   | No — allowlist + active links only |
| UI issue/void/pay here?        | No                                 |
| Empty links explain next step? | Yes — link student first           |
| MoMo blocked?                  | Yes — PAY-PROVIDER-001             |

## Next

- Parent portal auth bind (DBF/ACF) **or** PAY-PROVIDER supersede for MoMo — not both at once.
