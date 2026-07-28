# IMP-035 — Central admin error mapper

| Field     | Value                                 |
| --------- | ------------------------------------- |
| Program   | **IMP-035**                           |
| Date      | 2026-07-28                            |
| From      | AUDIT-ADMIN-UI-R1 G3 / T3             |
| Freezes   | DSF-002 v**1.21**                     |
| Depends   | IMP-027 Banner; IMP-033 gate; IMP-034 |
| Authority | Solo-operator provisional             |

## Goal

One **`adminFriendlyMessage(err, domain)`** for all admin API errors — consistent 403/401/404/409 copy per DSF; eliminate per-page `*Message` drift.

## Delivered

| Piece                    | Detail                                                              |
| ------------------------ | ------------------------------------------------------------------- |
| `apiFriendlyMessage`     | Shared status core in `lib/api/api-friendly-message.ts`             |
| `adminFriendlyMessage`   | Domain 403 + 409 fallbacks in `lib/admin/admin-friendly-message.ts` |
| `teacherFriendlyMessage` | Delegates to shared core (behavior unchanged)                       |
| Lib wrappers             | `studentMessage` etc. thin re-exports (deprecated)                  |
| Admin pages              | **35** routes migrated — no inline helpers                          |
| Tests                    | `admin-friendly-message.test.ts`; tooling grep gate                 |
| DSF-002                  | Rev 1.21 error copy table                                           |

## Domain → 403 copy (final)

| Domain                                                                                     | 403                                       |
| ------------------------------------------------------------------------------------------ | ----------------------------------------- |
| generic, users, memberships, organizations, students, guardians, roles, academic, settings | You do not have access for this action.   |
| finance                                                                                    | You do not have finance access.           |
| finance + reconcile                                                                        | You do not have finance reconcile access. |
| tenant                                                                                     | You do not have access for this school.   |

## Before / after

| Before | ~25 pages with different 403 strings; finance/guardian variants inline |
| After | Single mapper; grep: 0 `teacherFriendlyMessage` / `function *Message` under admin/** |

## Verify

```bash
npx vitest run apps/web/src/lib/admin/admin-friendly-message.test.ts apps/web/src/lib/api/client.test.ts tests/tooling/imp035-admin-error-mapper.test.ts
npm run check
```

## Doubt checks

| Check                              | Answer                                    |
| ---------------------------------- | ----------------------------------------- |
| Same 403 users vs students list?   | Yes — action copy (unless finance/tenant) |
| Finance reconcile 403?             | Yes — `action: 'reconcile'`               |
| teacherFriendlyMessage tests pass? | Yes                                       |
| Inline financeMessage left?        | No                                        |

## Residuals (Wave X)

- Parent `accessMessage` on parent portal
- Teacher shells could adopt `apiFriendlyMessage` only
- Kiswahili / i18n needs product decision
- Deprecated `*Message` re-exports in lib types (safe to delete when no external imports)

## Next

IMP-031 cross-links → IMP-032 settings safe form (AUDIT T2 order).
