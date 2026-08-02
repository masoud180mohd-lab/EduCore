# Manual QA — Admin polish session (IMP-029…035)

| Field   | Value                                                                     |
| ------- | ------------------------------------------------------------------------- |
| Date    | 2026-07-28                                                                |
| Lab     | Local Postgres + API `:3000` + web `:3001`                                |
| Actor   | `admin@educore.local` / owner                                             |
| Tenant  | `01900000-0010-7000-8000-000000000001`                                    |
| Scripts | `scripts/manual-qa-admin-polish.ts`, `scripts/manual-qa-admin-browser.ts` |

## Automated results (15/15 API + static)

| ID                               | Result | Notes                                     |
| -------------------------------- | ------ | ----------------------------------------- |
| prep.api_health                  | PASS   | `/health` 200                             |
| prep.login                       | PASS   | Owner login                               |
| prep.web                         | PASS   | `:3001` 200                               |
| imp033.me_owner                  | PASS   | `roles=owner`                             |
| imp032.seed_extra                | PASS   | PUT extra key `__qa_extra_imp032`         |
| imp032.save_known                | PASS   | Timezone → `Africa/Nairobi`               |
| imp032.extra_preserved           | PASS   | Extra object still on server after reload |
| imp032.timezone_updated          | PASS   |                                           |
| imp032.invalid_json_client       | PASS   | `tenant-settings-form.test.ts`            |
| imp029.source_grouped_nav        | PASS   | `AdminShell.tsx`                          |
| imp032.source_advanced_toggle    | PASS   | `showAdvanced` + toggle label             |
| imp032.source_preserve_merge     | PASS   | `mergeSettingsForSave(loadedExtras`       |
| imp034.source_confirm_advanced   | PASS   | Settings Advanced ConfirmDialog           |
| imp034.tooling_no_window_confirm | PASS   | Grep gate in tooling test                 |
| imp035.source_mapper             | PASS   | Central mapper module                     |

## Browser automated (10/10 — Playwright headless, Edge channel)

Run: `npx tsx scripts/manual-qa-admin-browser.ts`

| ID                                   | Result | Notes                                                   |
| ------------------------------------ | ------ | ------------------------------------------------------- |
| browser.login                        | PASS   | Admin home after login                                  |
| browser.nav_groups                   | PASS   | Grouped nav visible (≥3 groups)                         |
| browser.nav_768_no_overflow          | PASS   | No horizontal scroll @ 768px                            |
| browser.fees_current_on_list         | PASS   | Fees `aria-current` on invoices list                    |
| browser.settings_no_default_json     | PASS   | `#extrasJson` hidden by default                         |
| browser.settings_advanced_shows_json | PASS   | Advanced toggle reveals textarea                        |
| browser.settings_invalid_json        | PASS   | Client banner on invalid JSON                           |
| browser.void_confirm_dialog          | PASS   | ConfirmDialog uses `role="alertdialog"`                 |
| browser.void_esc_dismiss             | PASS   | Esc closes void confirm                                 |
| browser.student_crosslinks           | PASS   | Enrollments + Fees sections on student detail (IMP-031) |

## Tooling regression (24 tests)

```bash
npx vitest run apps/web/src/lib/admin/tenant-settings-form.test.ts \
  tests/tooling/imp029-admin-nav-ia.test.ts \
  tests/tooling/imp032-settings-operator-safe.test.ts \
  tests/tooling/imp034-admin-confirm-modal.test.ts \
  tests/tooling/imp035-admin-error-mapper.test.ts
```

**Result:** 24 passed

## Still manual / not covered in this session

| Check                                                  | Why skipped                                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Settings Advanced **Save click** through ConfirmDialog | Browser script validates invalid JSON + void confirm only; full Advanced save click not automated |
| Finance-only nav (Home + Fees only)                    | Needs finance-only seed user                                                                      |
| tenant.read-only Settings                              | Needs read-only seed user                                                                         |
| Reconcile 403 in browser                               | Needs finance role without reconcile permission                                                   |
| Keyboard tab order @ 1280px                            | Human pass recommended                                                                            |
| Guardian profile edit (IMP-019)                        | Out of IMP-029…035 polish scope                                                                   |

See also: `tasks/manual-test-admin-nav-ia-qa.md`, `tasks/manual-test-admin-settings-guardian-qa.md`, `tasks/manual-test-admin-fees-qa.md`.

## Residual / cleanup

- QA left `__qa_extra_imp032` in tenant settings — remove via Advanced JSON or leave for next QA
- Timezone currently `Africa/Nairobi` from preserve-merge test

## Sign-off

**Owner lab:** API/static + headless browser checks are **green** for IMP-029, IMP-031 (cross-links), IMP-032 (default UI + invalid JSON), IMP-034 (void ConfirmDialog), IMP-035 (invalid JSON message). Residual items above are role-matrix cases and one optional ConfirmDialog save click.
