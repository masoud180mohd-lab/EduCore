# IMP-029 — AdminShell nav IA for tablet

| Field     | Value                      |
| --------- | -------------------------- |
| Program   | **IMP-029**                |
| Date      | 2026-07-27                 |
| From      | AUDIT-ADMIN-UI-R1 G12 / T1 |
| Freezes   | DSF-002 v**1.19**          |
| Depends   | IMP-033 (AuthZ gate) green |
| Authority | Solo-operator provisional  |

## Goal

Restructure AdminShell navigation so tablet (~768px) office use is scannable without a cramped strip of ~10 peer links — while preserving IMP-033 `visibleAdminNavIds` filtering.

## Pattern chosen

**Option A — Grouped top nav** (AUDIT default). Section labels + links under each group; wrap by group.

## Delivered

| Piece           | Detail                                                            |
| --------------- | ----------------------------------------------------------------- |
| `groupAdminNav` | Pure helper in `admin-access.ts`; empty groups omitted            |
| AdminShell      | Grouped `<nav aria-label="Admin">` from filtered ids only         |
| tokens.css      | `.admin-nav-group*`, ≥44px link targets, flex-wrap on header      |
| Admin home hub  | Same groups via `groupAdminNav` (Home group skipped on hub)       |
| Unit tests      | Owner full groups; finance-only Fees not Access; partial registry |
| DSF-002         | Rev 1.19 Nav IA section                                           |

## Groups

| Group    | Members                                  |
| -------- | ---------------------------------------- |
| Home     | `home`                                   |
| Registry | `students`, `guardians`, `organizations` |
| Access   | `users`, `memberships`, `roles`          |
| Academic | `academic`                               |
| Fees     | `fees`                                   |
| Settings | `settings`                               |

## Before / after (768px)

| Before | Flat ~10 peer links in one flex row → crowded / hard to scan; risk of horizontal overflow when brand + logout compete for width |
| After | 5–6 labeled groups wrap as units; links stay ≥44px; page shell does not require horizontal scroll for nav |

## Acceptance

| Criterion                             | Status |
| ------------------------------------- | ------ |
| Option A documented in DSF-002        | Done   |
| Nav ⊆ `visibleAdminNavIds` only       | Done   |
| Empty groups omitted                  | Done   |
| Home hub mirrors groups               | Done   |
| Routes unchanged                      | Done   |
| Denied/loading from IMP-033 unchanged | Done   |
| `npm run check` green                 | Done   |

## Non-goals (honored)

Permission redesign; shadcn sidebar; Parent/Teacher shells; route renames; IMP-030/028/034; Wave X sessionStorage / collapse.

## Verify

```bash
npx vitest run apps/web/src/lib/auth/admin-access.test.ts tests/tooling/imp029-admin-nav-ia.test.ts
npm run check
```

## Manual QA

See `tasks/manual-test-admin-nav-ia-qa.md`.

## Doubt checks

| Check                                                        | Answer                                        |
| ------------------------------------------------------------ | --------------------------------------------- |
| At 768px, do 10 owner links still overflow horizontally?     | No — wrap by group; shell max-width contained |
| Does finance-only user see Users/Roles?                      | No — Access group omitted                     |
| Is Academic still one tap from shell?                        | Yes                                           |
| Does deep link `/admin/fees/invoices/...` mark Fees current? | Yes — `startsWith` on href                    |

## Residuals

- Phone (&lt;768) stacked groups only — full mobile IA out of scope
- Optional Wave X: last-group memory (Option B) / collapse affordance
- Duplicate `/tenants/current` fetch (shell + home) — AUDIT G9 residual

## Next

IMP-034 confirms (or remaining AUDIT order) — pagination/tables already shipped (IMP-030/028).
