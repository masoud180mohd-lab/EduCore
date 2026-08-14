# IMP-046 — Admin office console layout

| Field     | Value |
| --------- | ----- |
| Program   | **IMP-046** |
| Date      | 2026-08-14 |
| Status    | **Done** (solo-operator provisional) |
| Freezes   | DSF-KIT-001 v**1.1** · DSF-002 v**1.28** |
| Depends   | IMP-029 grouped IA · IMP-033 AuthZ gate |
| Authority | Owner + AI (SOLO-GOV-002) |

## Outcome

Replace the cramped grouped top-nav AdminShell with a professional office console: persistent left rail (same IMP-029 groups) + top utility bar (school name, Log out). Routes, AuthZ, and capability filtering unchanged.

## Delivered

| Surface | Change |
| ------- | ------ |
| `AdminShell` | Left rail + utility bar; mobile hamburger / overlay / Esc |
| `tokens.css` | `--color-rail*` + `--content-max-admin: 72rem` + `.admin-console*` |
| Admin home | Tighter “Office” hub; group cards in a grid |
| DSF-KIT-001 | Amend 1.1 — AdminShell layout + rail tokens |
| DSF-002 | Amend 1.28 — Option A groups kept; chrome is the rail |

## Explicitly not done

- TeacherShell / ParentShell restyle
- New component library (shadcn/MUI)
- Route or permission redesign
- ClickPesa / marketing landing
