# IMP-028 — Admin ops tables + density

| Field     | Value                               |
| --------- | ----------------------------------- |
| Program   | **IMP-028**                         |
| Date      | 2026-07-27                          |
| From      | AUDIT-ADMIN-UI-R1 G4 / T1 roadmap   |
| Freezes   | DSF-002 v**1.18**; DSF-004 v**1.2** |
| Authority | Solo-operator provisional           |

## Goal

Replace card-stack operational lists with dense `AdminTable` for Users, Students, Invoices, and Receipts — compose with IMP-027 ResourceList + IMP-030 Load more.

## Delivered

| Piece                          | Detail                                                                    |
| ------------------------------ | ------------------------------------------------------------------------- |
| `AdminTable`                   | `apps/web/src/components/admin/AdminTable.tsx` — semantic table + caption |
| `ResourceList variant="table"` | Children not wrapped in `ul.list`                                         |
| Tokens                         | `.admin-table*`, horizontal scroll wrapper                                |
| Migrated                       | Users, Students, Invoices, Receipts lists                                 |

## Pagination

All four lists keep `ResourceListPagination` + `appendById` / `nextCursor`. Load more unchanged.

## Residuals (still cards)

Guardians, Organizations, Memberships, Roles, Academic entity lists, Fee structures — Wave X / later.

## Acceptance

| Criterion                                  | Status |
| ------------------------------------------ | ------ |
| Shared AdminTable (no one-off HTML tables) | Done   |
| 4 AUDIT priority lists migrated            | Done   |
| StatusChip on status columns               | Done   |
| Open ≥44px                                 | Done   |
| Load more retained                         | Done   |
| No new PII / Nest APIs / Tailwind          | Done   |

## Non-goals

TanStack Table; Imp-029 nav; academic/guardians tables; MoMo.

## Verify

```bash
npx vitest run tests/tooling/imp028-admin-ops-tables.test.ts
npm run check
```

## Doubt checks

| Check                                   | Answer                             |
| --------------------------------------- | ---------------------------------- |
| Bursar compare invoice balances faster? | Yes — Total + Balance columns      |
| Primary actions ≥44px?                  | Yes — `.btn` / `.admin-table-open` |
| Load more still works?                  | Yes — footer on all 4              |
| New PII beyond prior cards?             | No                                 |
