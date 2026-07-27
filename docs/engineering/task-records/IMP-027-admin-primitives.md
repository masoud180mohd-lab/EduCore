# IMP-027 — Admin shared UI primitives

| Field     | Value                                  |
| --------- | -------------------------------------- |
| Program   | **IMP-027**                            |
| Date      | 2026-07-27                             |
| From      | AUDIT-ADMIN-UI-R1 T1 / roadmap IMP-027 |
| Freezes   | DSF-002 (component inventory)          |
| Authority | Solo-operator provisional              |

## Goal

Extract shared admin chrome primitives from DSF-001/002 language and migrate three registries onto them — without a visual brand redesign.

## Delivered

| Primitive         | Path                                                       |
| ----------------- | ---------------------------------------------------------- |
| `Banner`          | `apps/web/src/components/admin/Banner.tsx`                 |
| `AdminPageHeader` | `…/AdminPageHeader.tsx`                                    |
| `ResourceList`    | `…/ResourceList.tsx`                                       |
| `StatusChip`      | `…/StatusChip.tsx`                                         |
| `ConfirmDialog`   | `…/ConfirmDialog.tsx` (Esc + focus cancel; danger confirm) |

**Migrated pages:** Students list, Guardians list, Organizations list + org detail deactivate (ConfirmDialog replaces `window.confirm`).

**Tokens:** `.section-title`, `.admin-page-header`, `.resource-list`, `.confirm-dialog*` in `tokens.css`.

## Acceptance

| Criterion                                              | Status                |
| ------------------------------------------------------ | --------------------- |
| 3 domains use ResourceList + AdminPageHeader           | Done                  |
| ConfirmDialog on at least one destructive admin action | Done (org deactivate) |
| No Tailwind/shadcn introduction                        | Done                  |
| Calm EduCore tokens retained                           | Done                  |

## Out of scope

- Pagination (IMP-030)
- Ops tables (IMP-028)
- Migrating every admin page in one PR
- Replacing all remaining `window.confirm` call sites

## Verify

```bash
npx vitest run tests/tooling/imp027-admin-primitives.test.ts
npm run typecheck -w @educore/web
```
