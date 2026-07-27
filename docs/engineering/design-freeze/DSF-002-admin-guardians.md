# DSF-002 — Admin shell + Guardians / Academic UI (provisional)

| Field     | Value                                                                                                                                                                                                 |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Freeze ID | `DSF-002`                                                                                                                                                                                             |
| Version   | `1.19`                                                                                                                                                                                                |
| Date      | 2026-07-27                                                                                                                                                                                            |
| Audience  | School admin / headmaster (desktop-first, usable on tablet)                                                                                                                                           |
| Authority | Solo-operator provisional (SOLO-GOV-001)                                                                                                                                                              |
| Program   | IMP-007 · IMP-012 · IMP-013 · IMP-014 · IMP-015 · IMP-016 · IMP-017 · IMP-018 · IMP-019 · IMP-020 · IMP-021 · IMP-022 · IMP-023 · IMP-025 · IMP-026 · IMP-027 · IMP-028 · IMP-029 · IMP-030 · IMP-033 |

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
2. **Admin home** — school name + **grouped** short links (Registry / Access / Academic / Fees / Settings) mirroring shell IA (IMP-029)
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

- `AdminShell` — header brand = school name from `GET /tenants/current` (fallback `EduCore Admin`); Logout; **grouped top nav (IMP-029 Option A)** — see Nav IA below
- Shared banners, buttons, fields from DSF-001 language
- **IMP-027 primitives:** `Banner`, `AdminPageHeader`, `ResourceList`, `StatusChip`, `ConfirmDialog` under `apps/web/src/components/admin/`
- **IMP-028 ops tables:** `AdminTable` for dense registries (Users, Students; fees lists in DSF-004); `ResourceList variant="table"`
- **IMP-030 pagination:** `ResourceListPagination` (“Load more”) + `ResourceList` optional `footer`; shared helper `apps/web/src/lib/admin/list-pagination.ts`
- **IMP-029 nav model:** `groupAdminNav(visibleAdminNavIds)` in `apps/web/src/lib/auth/admin-access.ts`
- `ResourceList` pattern (loading / empty / error / forbidden / optional Load more footer)
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
- **Nav filter (IMP-033):** top-nav (and home hub cards) only list domains the actor’s permissions can reach; API remains AuthZ truth for mutations. **IMP-029 does not redesign permissions** — it only groups already-visible ids.
- Attendance-only staff / parent-only → no AdminShell (teacher or parent workspace)
- Post-login home preference (`prefersAdminHome`) unchanged — still prefers owner/admin/user-invite surfaces; bursars may open Admin Fees via URL when `finance.*` is present

## Nav IA — tablet grouped top nav (IMP-029)

**Pattern chosen: Option A — Grouped top nav.** Section labels + links under each group; wrap by _group_, not ten equal peer links. Routes unchanged (`/admin/users`, etc.).

| Group        | `AdminNavId` members (when visible)      |
| ------------ | ---------------------------------------- |
| **Home**     | `home`                                   |
| **Registry** | `students`, `guardians`, `organizations` |
| **Access**   | `users`, `memberships`, `roles`          |
| **Academic** | `academic`                               |
| **Fees**     | `fees`                                   |
| **Settings** | `settings`                               |

| Rule              | Behavior                                                                              |
| ----------------- | ------------------------------------------------------------------------------------- |
| Visibility source | `visibleAdminNavIds(me)` only — no new permission matrix                              |
| Empty groups      | Omit entirely when all member ids filtered out                                        |
| Home hub          | Mirror the same groups/cards; skip Home group on the hub itself                       |
| Active state      | `aria-current="page"` on current link; deep links (e.g. `/fees/invoices/…`) mark Fees |
| Tablet (≥768)     | Usable without horizontal page scroll; primary nav links ≥44px tall                   |
| Desktop (≥1024)   | Same grouped IA; calm and scannable                                                   |
| Mobile (&lt;768)  | Best-effort stacked groups; full phone IA redesign out of scope                       |
| A11y              | `<nav aria-label="Admin">`; group headings + labelled lists; no hover-only access     |

**Non-goals (nav IA):** permission redesign; shadcn/marketing sidebar; ParentShell/TeacherShell; route renames; Option B sessionStorage / Option C side rail (unless a later DSF revise).

## List pagination (IMP-030 / ACF)

Primary admin **registry** lists consume ACF envelopes `{ data, page: { nextCursor, limit } }`:

| Rule    | Behavior                                                                                                |
| ------- | ------------------------------------------------------------------------------------------------------- |
| Pattern | **Load more (append)** — not numbered pages / offset                                                    |
| Control | Show **Load more** only when `page.nextCursor` is non-null; busy label **Loading more…**                |
| Filters | Load more repeats the **same** search/status/year/class filters as the first page                       |
| Reset   | Changing a filter clears rows + cursor and fetches a new first page                                     |
| Honesty | Never invent `totalCount` / “Page N of M”; never imply “all rows” while ignoring `nextCursor`           |
| Limit   | Keep existing per-list limits (typically 50; roles/subjects may use ≤100); do not raise above 100       |
| Auth    | Same Bearer + `X-Tenant-Id`; cursor is opaque — pass with `encodeURIComponent`; do not decode for AuthZ |

**Non-goals (pagination):** virtualized infinite-scroll libraries; offset/page-number UI; fetching `limit=10000` to avoid paging; client-side fake paging of a truncated first page; Nest API redesign.

Form **pickers** (student/year/structure dropdowns) may still hard-cap one page — residual until Wave X; primary registries must not silently truncate.

## Ops tables (IMP-028 / EduCore dense admin)

Use **`AdminTable`** for high-traffic operational registries. Keep **cards** for hubs, create forms, pickers, and not-yet-migrated lists (Guardians, Orgs, Memberships, Academic, fee structures).

| Registry | Columns (allowlist only)                                |
| -------- | ------------------------------------------------------- |
| Users    | Display name, Email, Status (`StatusChip`), Open        |
| Students | Display name, Student code, Status (`StatusChip`), Open |

**Density & a11y**

- Tighter row padding than cards; meta/body at 0.875rem; subtle row borders (no loud zebra)
- Primary actions (Create, Open, Search, Load more) remain ≥44px (`.btn`)
- Row pattern: identity text + dedicated **Open** control (consistent; focus-visible)
- Real `<th>` / `<caption>`; wrap in `.admin-table-wrap` with horizontal scroll on narrow viewports — do **not** fall back to pure cards for these lists
- Compose: `ResourceList variant="table"` → `AdminTable` → `ResourceListPagination` footer
- No client-side sort without API support; no invented columns / PII beyond prior list cards

**Non-goals (tables):** TanStack Table / shadcn DataGrid; virtualization; migrating every admin list in one PR.

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
- Offset pagination / invented list totals (IMP-030)

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
| 1.17 | 2026-07-27 | IMP-030 Load more cursor pagination on admin registries             |
| 1.18 | 2026-07-27 | IMP-028 AdminTable for Users/Students ops lists                     |
| 1.19 | 2026-07-27 | IMP-029 grouped AdminShell nav IA for tablet (Option A)             |
