# DSF-002 — Admin shell + Guardians / Academic UI (provisional)

| Field     | Value                                                                                     |
| --------- | ----------------------------------------------------------------------------------------- |
| Freeze ID | `DSF-002`                                                                                 |
| Version   | `1.3`                                                                                     |
| Date      | 2026-07-25                                                                                |
| Audience  | School admin / headmaster (desktop-first, usable on tablet)                               |
| Authority | Solo-operator provisional (SOLO-GOV-001)                                                  |
| Program   | IMP-007 · IMP-012 · IMP-013 (structure PATCH) · **IMP-014** (structure DELETE + reparent) |

**Honesty:** Provisional design-system slice. Does **not** accept kit-wide Design System Freeze. Reuses DSF-001 tokens; defines admin chrome, guardians registry, and Academic Structure screens.

## Goal

Calm operations shell for school admins: school overview, staff directory, organizations, students, guardians, **academic structure + enrollments**, fees, and tenant settings — against existing Nest APIs (ACF-001–010) plus fees ACF-012.

## Tokens

Reuse DSF-001 CSS variables (`--color-*`, `--space-*`, `--font-sans`, `--radius`, `--focus-ring`). Admin shell may use a wider content max-width (`48rem`–`56rem`) vs teacher `40rem`.

Avoid purple-on-white AI defaults and marketing hero chrome.

## Type & density

- Title: 1.25rem / 600
- Body: 1rem / 400
- Meta: 0.875rem / 400
- Admin tables/lists: denser rows than teacher mark flow; still ≥44px touch for primary actions

## Screens in scope

1. **Login routing** — after bind, `/auth/me` decides admin vs teacher home
2. **Admin home** — school name + short links (Users, Orgs, Students, Guardians, **Academic**, Fees, Settings)
3. **Users list** — `GET /users` (search optional)
4. **Organizations list** — `GET /organizations`
5. **Students list** — `GET /students` (admin read; create deferred unless trivial)
6. **Tenant settings read** — `GET /tenant-settings`
7. **Guardians list** — `GET /guardians`
8. **Guardian detail** — get + linked students; create guardian; link/unbind portal user
9. **Academic hub** — `/admin/academic` short links (Years, Terms, Classes, Streams, Subjects, Enrollments) — **IMP-012**
10. **Academic entity list + create + edit detail** — years / terms / classes / streams / subjects (ACF-003…007 rev 1.4). Structure PATCH for rename/code/dates/status; **edit + delete (confirm)**; reparent on term/class/stream (`academicYearId` on terms/classes, `termId` on classes, `classId` on streams) via detail edit form.
11. **Enrollments** — list + create + detail + **status PATCH** only (ACF-008)

## Component inventory (this slice)

- `AdminShell` (nav: Home / Users / Orgs / Students / Guardians / **Academic** / Fees / Settings / Logout)
- Shared banners, buttons, fields from DSF-001 language
- `ResourceList` pattern (loading / empty / error / forbidden)
- Guardian form (displayName, optional phone/email)
- Link-student control (student picker + relationship type)
- Academic create forms (name, optional code/dates, status default **active**)
- Academic detail edit forms (name/code/dates/status; confirm when status → `closed`)
- Delete button (destructive, confirm dialog) on academic entity detail — years/terms/classes/streams/subjects
- Parent pickers (reparent controls) on term/class/stream detail edit: academic year picker (terms, classes), term picker incl. "none" (classes), class picker (streams)
- Enrollment create (student + class + optional stream); status control on detail

## AuthZ UX

- Unbound tenant → `/login`
- 401 → Sign in again
- 403 → “You do not have access for this action.” (academic: needs `academic.read` / `academic.manage`)
- Staff without admin perms → teacher shell only (no admin nav)

## Non-goals

- Parent portal chrome (DSF-006)
- Marks / AI
- Fees / bursar chrome — **DSF-004** (IMP-010)
- MoMo / mobile money payment UX (PAY-PROVIDER-001) — out of scope
- Cascade delete UX (delete stays empty-only; 409 surfaced as a plain error, no dependent-listing UI)
- Bulk enroll / transfer / timetable / report cards
- Roles/permissions admin CRUD (`/roles` HTTP missing)
- MFA enrollment
- Full offline sync
- Marketing dashboards / charts

## Auth storage

Same as DSF-001: Bearer + `X-Tenant-Id` in `sessionStorage` until httpOnly cookie path exists. Threat: XSS can read tokens — mitigate with CSP later; never `localStorage`.

## Solo-operator honesty

Accepted under acting seats only; revise when a second review seat exists.
