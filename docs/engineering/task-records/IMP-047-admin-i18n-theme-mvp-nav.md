# IMP-047 — Admin i18n, dark mode, MVP nav modules

| Field     | Value |
| --------- | ----- |
| Program   | **IMP-047** |
| Date      | 2026-08-14 |
| Status    | **Done** (solo-operator provisional) |
| Freezes   | DSF-KIT-001 v1.1 amend (theme tokens) |
| Depends   | IMP-046 office console |
| Authority | Owner + AI (SOLO-GOV-002) |

## Outcome

Add English/Kiswahili UI toggle and light/dark theme to Admin chrome; extend MVP nav with Staff, Attendance, Exams, Report cards, Reports, and Announcements surfaces.

## Delivered

| Area | Detail |
| ---- | ------ |
| i18n | `lib/i18n/messages.ts` EN/SW; shell + hub translated; sessionStorage preference |
| Theme | `[data-theme=dark]` tokens; top-bar toggle; boot script avoids flash |
| Nav | `staff`, `attendance`, `exams`, `reportCards`, `reports`, `announcements` |
| Pages | List/placeholder routes wired to existing APIs where available |

## Explicitly not done

- Full page-by-page translation (domain screens still mostly English)
- Report card PDF generation
- Analytics dashboard backend
- In-app announcements product
- TeacherShell / ParentShell i18n+theme
