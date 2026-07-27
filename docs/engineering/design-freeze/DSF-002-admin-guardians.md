# DSF-002 — Admin shell + Guardians / Academic UI (provisional)

| Field     | Value                                                       |
| --------- | ----------------------------------------------------------- |
| Freeze ID | `DSF-002`                                                   |
| Version   | `1.16`                                                      |
| Date      | 2026-07-27                                                  |
| Audience  | School admin / headmaster (desktop-first, usable on tablet) |
| Authority | Solo-operator provisional (SOLO-GOV-001)                    |
| Program   | IMP-007 · … · IMP-033 · **IMP-027**                         |

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
2. **Admin home** — school name + short links (Users, **Memberships**, Orgs, Students, Guardians, **Roles**, **Academic**, Fees, Settings)
3. **Users list + invite + edit detail** — `GET /users` (search optional); invite via `POST /memberships`; detail `PATCH` displayName + `POST …/disable` + **`POST …/enable`** + **membership suspend / reactivate / remove** via `POST /memberships/{id}/…` (ACF-001; resolve membership with `GET /memberships?userId=`). **User-role assign/unassign** on detail (`GET/POST /user-roles`, `DELETE /user-roles/{id}`) with optional **organization scope** (IMP-026).
4. **Memberships list** — `GET /memberships` with optional status filter; row links to user detail for lifecycle actions (IMP-023).
5. **Roles list + create + edit detail** — `GET/POST /roles`; detail rename (`PATCH`) + permission replace for **custom** roles (`PUT …/permissions`); system roles read-only grants (ACF-001 §4.7). No role DELETE.
6. **Organizations list + create + edit detail** — `GET/POST /organizations`; detail `PATCH` + `POST …/deactivate` (ACF-001). No org DELETE.
7. **Students list + create + edit detail** — `GET/POST /students`, `GET/PATCH /students/{id}` (ACF-002). No student DELETE in UI.
8. **Tenant settings edit** — `GET` + `PUT /tenant-settings` (ACF-001); form for known keys + settings JSON merge
9. **Guardians list** — `GET /guardians`
10. **Guardian detail** — get + **profile edit** (displayName/phone/email/status PATCH); linked students; create guardian; link/unbind portal user
11. **Academic hub** — `/admin/academic` short links (Years, Terms, Classes, Streams, Subjects, Enrollments) — **IMP-012**
12. **Academic entity list + create + edit detail** — years / terms / classes / streams / subjects (ACF-003…007 rev 1.4). Structure PATCH for rename/code/dates/status; **edit + delete (confirm)**; reparent on term/class/stream (`academicYearId` on terms/classes, `termId` on classes, `classId` on streams) via detail edit form.
13. **Enrollments** — list + create + detail + **status PATCH** + **placement transfer** (`classId` / `streamId`, ACF-008 rev 1.4)

## Component inventory (this slice)

- `AdminShell` (nav: Home / Users / **Memberships** / Orgs / Students / Guardians / **Roles** / **Academic** / Fees / Settings / Logout); header brand = school name from `GET /tenants/current` (fallback `EduCore Admin`)
- Shared banners, buttons, fields from DSF-001 language
- **IMP-027 primitives:** `Banner`, `AdminPageHeader`, `ResourceList`, `StatusChip`, `ConfirmDialog` under `apps/web/src/components/admin/`
- `ResourceList` pattern (loading / empty / error / forbidden)
- Guardian form (displayName, optional phone/email); guardian detail **profile edit** (displayName/phone/email/status)
- Tenant settings form (timezone/locale/currency + settings JSON; PUT save)
- Student create/edit forms (displayName, optional studentCode, status default **active**)
- Org create/edit forms (orgType, name, optional code/parent); deactivate confirm on detail
- User invite form (email, optional displayName, roleCodes owner|admin|staff); detail edit displayName + disable/enable confirm; **membership status + Suspend / Reactivate / Remove** (confirm; no self suspend/remove/enable); **user-role assign/unassign** with scope select (Entire tenant | organization)
- Memberships list (status filter: all / invited / active / suspended / removed); link to user detail
- Roles list + create custom (code, name); detail rename; permission checklist for custom roles (system grants read-only)
- Link-student control (student picker + relationship type)
- Academic create forms (name, optional code/dates, status default **active**)
- Academic detail edit forms (name/code/dates/status; confirm when status → `closed`)
- Delete button (destructive, confirm dialog) on academic entity detail — years/terms/classes/streams/subjects; **409 dependents banner** lists blocker types/counts/samples with admin links (IMP-025)
- Parent pickers (reparent controls) on term/class/stream detail edit: academic year picker (terms, classes), term picker incl. "none" (classes), class picker (streams)
- Enrollment create (student + class + optional stream); status control on detail; **transfer** class/stream pickers on detail

## AuthZ UX

- Unbound tenant → `/login`
- 401 → Sign in again
- 403 → “You do not have access for this action.” (academic: `academic.read` / `academic.manage`; students: `student.read` / `student.manage`; orgs: `organization.manage`; users: `user.invite` / `user.manage` / membership lifecycle; roles: `role.read` / `role.manage`; settings: `tenant.manage`; guardians: `guardian.manage`; fees: `finance.read` / `finance.manage` / `finance.reconcile`)
- **AdminShell gate (IMP-033):** after session↔tenant bind, `GET /auth/me` must show an admin-domain capability (owner/admin role **or** any of tenant/user/org/student/guardian/role/academic/finance read|manage). Otherwise show “Admin unavailable” with link to teacher/parent — do **not** render privileged nav or page children.
- **Nav filter (IMP-033):** top-nav (and home hub cards) only list domains the actor’s permissions can reach; API remains AuthZ truth for mutations.
- Attendance-only staff / parent-only → no AdminShell (teacher or parent workspace)
- Post-login home preference (`prefersAdminHome`) unchanged — still prefers owner/admin/user-invite surfaces; bursars may open Admin Fees via URL when `finance.*` is present

## Non-goals

- Parent portal chrome (DSF-006)
- Marks / AI
- Fees / bursar chrome — **DSF-004** (IMP-010)
- MoMo / mobile money payment UX (PAY-PROVIDER-001) — out of scope
- Bulk enroll / bulk transfer / timetable / report cards
- MFA enrollment
- Full offline sync
- Marketing dashboards / charts
- Org-scoped **permission enforcement** (assignment storage only in IMP-026; AuthZ union unchanged)
- DELETE role / mutate system role permission grants via product API

## Auth storage

Same as DSF-001: Bearer + `X-Tenant-Id` in `sessionStorage` until httpOnly cookie path exists. Threat: XSS can read tokens — mitigate with CSP later; never `localStorage`.

## Solo-operator honesty

Accepted under acting seats only; revise when a second review seat exists.

## Revisions

| Ver  | Date       | Notes                                                               |
| ---- | ---------- | ------------------------------------------------------------------- |
| 1.13 | 2026-07-27 | IMP-025 academic delete dependents listing on 409                   |
| 1.14 | 2026-07-27 | IMP-026 org-scoped user-role assign (storage + UI)                  |
| 1.15 | 2026-07-27 | IMP-033 AdminShell /auth/me gate + permission-filtered nav          |
| 1.16 | 2026-07-27 | IMP-027 shared admin primitives (Banner/ResourceList/ConfirmDialog) |
