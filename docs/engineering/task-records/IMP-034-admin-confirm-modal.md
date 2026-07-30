# IMP-034 — Admin ConfirmDialog (replace window.confirm)

| Field     | Value                                       |
| --------- | ------------------------------------------- |
| Program   | **IMP-034**                                 |
| Date      | 2026-07-27                                  |
| From      | AUDIT-ADMIN-UI-R1 G5 / T3                   |
| Freezes   | DSF-002 rev 1.20; DSF-004 void/reverse note |
| Depends   | IMP-027 ConfirmDialog; org deactivate twin  |
| Authority | Solo-operator provisional                   |

## Goal

Replace native `window.confirm` on admin money + membership (+ other admin destructive) actions with shared **ConfirmDialog** (Esc, Cancel focus, danger, busy, focus restore).

## Inventory

| Path                       | Action                                   | Severity              | Status         |
| -------------------------- | ---------------------------------------- | --------------------- | -------------- |
| fees/invoices/[id]         | void                                     | Must / danger         | Migrated       |
| fees/invoices/[id]         | payment reverse                          | Must / danger         | Migrated       |
| users/[id]                 | disable / enable                         | Must                  | Migrated       |
| users/[id]                 | membership suspend / reactivate / remove | Must                  | Migrated       |
| users/[id]                 | role unassign                            | Must / danger         | Migrated       |
| organizations/[id]         | deactivate                               | Already ConfirmDialog | Unchanged twin |
| guardians/[id]             | end link / unbind                        | Should / danger       | Migrated       |
| academic */[id]            | mark closed + delete                     | Should / danger       | Migrated       |
| enrollments/[id]           | status + transfer                        | Should                | Migrated       |
| teacher marks / attendance | submit / close                           | Wave X                | **Done** (IMP-034x) |
| Pickers                    | —                                        | Wave X                | See IMP-030x        |

## ConfirmDialog API changes

- Focus restore to opener on close (`previouslyFocused` + `queueMicrotask`)
- Esc `preventDefault` when dismissing
- Enter policy unchanged: focused control only (Cancel default) — does not auto-confirm
- Public props stable for org deactivate twin

## Grep

| Scope                       | Before (approx) | After           |
| --------------------------- | --------------- | --------------- |
| `admin/**` `window.confirm` | ~20 call sites  | **0**           |
| Teacher Wave X              | 2               | **0**           |

## Waves

| Wave                        | Status      |
| --------------------------- | ----------- |
| C0 inventory + DSF + harden | Done        |
| C1 money                    | Done        |
| C2 users/membership         | Done        |
| C3 guardian + academic      | Done        |
| C4 tooling + check          | Done        |
| Wave X pickers / teacher    | **Done** (IMP-034x + IMP-030x) |

## Verify

```bash
npx vitest run tests/tooling/imp034-admin-confirm-modal.test.ts
npm run check
```

## Doubt checks

| Question                            | Answer                      |
| ----------------------------------- | --------------------------- |
| Esc dismiss without mutate?         | Yes                         |
| Double-click Confirm double-POST?   | No — busy + Idempotency-Key |
| Cancel focused on open?             | Yes                         |
| window.confirm on money/membership? | Zero                        |
| Pickers changed?                    | No                          |
