# IMP-028 — Admin ops tables + density

| Field     | Value                                  |
| --------- | -------------------------------------- |
| Program   | **IMP-028**                            |
| Date      | 2026-07-27 (residual close 2026-07-31) |
| From      | AUDIT-ADMIN-UI-R1 G4 / T1 roadmap      |
| Freezes   | DSF-002 v**1.26**; DSF-004 v**1.4**    |
| Authority | Solo-operator provisional              |

## Goal

Replace card-stack operational lists with dense `AdminTable` — compose with IMP-027 ResourceList + IMP-030 Load more.

## Delivered

| Piece                          | Detail                                                                    |
| ------------------------------ | ------------------------------------------------------------------------- |
| `AdminTable`                   | `apps/web/src/components/admin/AdminTable.tsx` — semantic table + caption |
| `ResourceList variant="table"` | Children not wrapped in `ul.list`                                         |
| Tokens                         | `.admin-table*`, horizontal scroll wrapper                                |
| Priority (AUDIT)               | Users, Students, Invoices, Receipts                                       |
| Residual wave                  | Guardians, Orgs, Memberships, Roles, Academic lists, Fee structures       |

## Pagination

All migrated lists keep `ResourceListPagination` + `appendById` / `nextCursor`. Load more unchanged.

## Still cards (by design)

Hubs (`/admin`, `/academic`, `/fees`), create forms, pickers, nested guardian-fee cards — not registry lists.

## Acceptance

| Criterion                                  | Status |
| ------------------------------------------ | ------ |
| Shared AdminTable (no one-off HTML tables) | Done   |
| AUDIT priority + residual registries       | Done   |
| StatusChip on status columns               | Done   |
| Open ≥44px                                 | Done   |
| Load more retained                         | Done   |
| No new PII / Nest APIs / Tailwind          | Done   |

## Non-goals

TanStack Table; Imp-029 nav; MoMo; hubs as tables.

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
| Load more still works?                  | Yes — footer on migrated lists     |
| New PII beyond prior cards?             | No                                 |
