# IMP-032 — Operator-safe tenant settings form

| Field     | Value                             |
| --------- | --------------------------------- |
| Program   | **IMP-032**                       |
| Date      | 2026-07-28                        |
| From      | AUDIT-ADMIN-UI-R1 G7 / T2         |
| Freezes   | DSF-002 v**1.23**                 |
| Depends   | IMP-019 settings PUT; IMP-033/035 |
| Authority | Solo-operator provisional         |

## Goal

Default Settings UI = timezone / locale / currency only. Raw JSON hidden behind Advanced disclosure. Normal save **preserves** server extras.

## Advanced policy

**Option A** — Advanced visible to all Settings viewers with warning (not owner/admin-only gate).

## Delivered

| Piece                     | Detail                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------ |
| `tenant-settings-form.ts` | split, merge, validate, extrasJsonChanged                                            |
| Settings page             | Advanced toggle; preserve-merge on normal save; ConfirmDialog on Advanced JSON edits |
| `canManageTenantSettings` | Read-only without tenant.manage                                                      |
| DSF-002                   | Rev 1.23 operator-safe rules                                                         |
| Tests                     | Unit + tooling                                                                       |

## Preserve-merge proof

Unit: `mergeSettingsForSave` keeps `customFlag` + `legacy` when only known keys change.

Manual: save timezone with hidden extras → reload → extras still present.

## Read-only

`tenant.read` without `tenant.manage` → disabled fields, no Save button, info banner.

## Verify

```bash
npx vitest run apps/web/src/lib/admin/tenant-settings-form.test.ts tests/tooling/imp032-settings-operator-safe.test.ts
npm run check
```

## Residuals (Wave X)

More known keys; settings diff preview before save.

## Next

IMP-031 cross-links (if not complete) or remaining AUDIT polish.
