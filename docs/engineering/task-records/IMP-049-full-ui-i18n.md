# IMP-049 — Full UI EN/SW chrome

| Field     | Value |
| --------- | ----- |
| Program   | **IMP-049** |
| Date      | 2026-08-14 |
| Status    | **Done** (solo-operator provisional) |
| Freezes   | DSF-KIT-001 v1.4 · DSF-002 v1.30 |
| Depends   | IMP-047 chrome i18n · IMP-048 Students/Fees i18n |
| Authority | Owner + AI (SOLO-GOV-002) |

## Outcome

Translate remaining visible Admin, Teacher, Parent, and login chrome so the language toggle covers office, classroom, and parent surfaces — not only Students and Fees.

## Delivered

| Area | Detail |
| ---- | ------ |
| Catalog | Extra EN/SW keys in `messages-extra.ts`; `MessageKey` from merged catalog; interpolation via `formatMessage` |
| Shells | TeacherShell / ParentShell nav + language/theme; Admin rail aria labels |
| Screens | Academic lists/details, users/roles/memberships, guardians, orgs, settings MFA, SMS, invoices/receipts, teacher attendance/marks, parent fees, login |
| Shared | ConfirmDialog, ResourceList, StatusChip (`translateToken`) |
| Test | EN/SW key parity in `messages.test.ts` |

## Honesty limits

- API / `adminFriendlyMessage` / `teacherFriendlyMessage` strings stay English.
- `<option value>` status tokens stay English API values; some dropdowns still show the token as the label.
- Auth0 vendor name is not translated.
- Permission codes remain technical identifiers.
- Some catch-block fallbacks still use English `Could not load…` when the API mapper does not apply.
