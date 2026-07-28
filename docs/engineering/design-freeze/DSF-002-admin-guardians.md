# DSF-002 — Admin shell + Guardians / Academic UI (provisional)

| Field     | Value                                                       |
| --------- | ----------------------------------------------------------- |
| Freeze ID | `DSF-002`                                                   |
| Version   | `1.22`                                                      |
| Date      | 2026-07-28                                                  |
| Audience  | School admin / headmaster (desktop-first, usable on tablet) |
| Authority | Solo-operator provisional (SOLO-GOV-001)                    |
| Program   | IMP-007 · … · IMP-034 · IMP-035 · **IMP-031**               |

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
- **403 (admin pages):** use central **`adminFriendlyMessage(err, domain)`** (`apps/web/src/lib/admin/admin-friendly-message.ts`) — see Error copy table below. API remains AuthZ truth.
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

## Confirm dialogs (IMP-034 / AUDIT G5)

Destructive admin mutations use shared **`ConfirmDialog`** — not `window.confirm`.

| Rule         | Behavior                                                                                                                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Required for | Money (void, reverse); membership/users (disable, enable, suspend, reactivate, remove, role unassign); org deactivate; guardian end-link / unbind; academic delete + mark closed; enrollment status/transfer |
| Keyboard     | **Esc** and backdrop dismiss when not busy; initial focus on **Cancel**; Enter activates focused control only (Cancel by default — does **not** auto-confirm)                                                |
| Focus        | Restore focus to the triggering control after close when practical                                                                                                                                           |
| Danger       | `danger={true}` for void, reverse, delete, remove, disable, unbind, suspend, end-link, mark closed                                                                                                           |
| Busy         | Confirm + Cancel + backdrop disabled while mutation in flight (no double POST); Idempotency-Key unchanged                                                                                                    |
| AuthZ        | Confirm UI ≠ authorization — API remains truth (403/409 after confirm)                                                                                                                                       |

**Non-goals (confirms):** modal libraries (Headless/Radix/shadcn); auto-confirm timers; **picker UX** (Wave X); teacher marks/attendance confirms (Wave X).

## Cross-links (IMP-031 / AUDIT G13)

Deep links reduce hub hunting. Compose existing list/detail APIs — no nested BFF expansions.

| From           | To                | Route                              | API                            | Permission gate                                 |
| -------------- | ----------------- | ---------------------------------- | ------------------------------ | ----------------------------------------------- |
| Student detail | Enrollment detail | `/admin/academic/enrollments/[id]` | `GET /enrollments?studentId=`  | `academic.read` (nav: Academic)                 |
| Student detail | Invoice detail    | `/admin/fees/invoices/[id]`        | `GET /invoices?studentId=`     | `finance.read` (nav: Fees)                      |
| Student detail | Guardian detail   | `/admin/guardians/[id]`            | `GET /students/{id}/guardians` | `guardian.read` (nav: Guardians)                |
| Invoice detail | Student detail    | `/admin/students/[id]`             | `invoice.studentId`            | `student.read` (link always when invoice loads) |
| Invoice detail | Guardian detail   | `/admin/guardians/[id]`            | `GET /students/{id}/guardians` | `guardian.read`                                 |
| Invoice detail | Guardian fees hub | `/admin/guardians/[id]/fees`       | —                              | `guardian.read` + `finance.read`                |

**UX rules**

- Sections on student detail: **Enrollments**, **Fees**, **Guardians** — each gated by IMP-033 nav visibility (`visibleAdminNavIds`).
- Per-section loading/error; 403 in one section does not break the edit form or sibling sections.
- Empty copy: “No enrollments yet for this student.” / “No invoices yet…” / “No active guardian links…”
- Create shortcuts link to existing create pages (Wave X: `?studentId=` prefill).
- Shared primitives: `RelatedRecordsSection`, `ResourceListPagination` (limit 25), `admin-paths` helpers.

**Non-goals (cross-links):** CRM graph; auto-create from link; parent portal (DSF-006).

## Error copy — central admin mapper (IMP-035 / AUDIT G3)

All routes under `apps/web/src/app/t/[tenantId]/admin/**` MUST map `ApiClientError` via **`adminFriendlyMessage(err, domain)`** — not per-page `*Message` helpers or `teacherFriendlyMessage`.

| Domain / rule                                                                                                | 403 copy                                              |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `generic`, `users`, `memberships`, `organizations`, `students`, `guardians`, `roles`, `academic`, `settings` | “You do not have access for this action.”             |
| `finance`                                                                                                    | “You do not have finance access.”                     |
| `finance` + `action: 'reconcile'`                                                                            | “You do not have finance reconcile access.” (DSF-004) |
| `tenant` (admin home / shell fetch)                                                                          | “You do not have access for this school.”             |

| Status                | Behavior                                                    |
| --------------------- | ----------------------------------------------------------- |
| 401                   | Sign in again                                               |
| 404                   | Not found                                                   |
| 409                   | Prefer API `err.message`; domain-safe fallback when empty   |
| Network / idempotency | Shared `apiFriendlyMessage` core (same as teacher baseline) |

**Non-goals (error copy):** i18n / Kiswahili framework; Nest error envelope changes; toast/snackbar system; teacher/parent shell migration (Wave X).

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

## Increment traceability

| IMP     | Topic (summary)                                               |
| ------- | ------------------------------------------------------------- |
| IMP-012 | Academic hub + entity list/create flows                       |
| IMP-013 | Academic structure PATCH on detail edit forms                 |
| IMP-014 | Academic delete + reparent controls on detail                 |
| IMP-015 | Students list + create + edit detail                          |
| IMP-016 | Users invite/edit + organizations create/edit/deactivate      |
| IMP-017 | AdminShell school name brand from `GET /tenants/current`      |
| IMP-019 | Tenant settings edit + guardian profile edit on detail        |
| IMP-020 | Membership suspend / reactivate / remove on user detail       |
| IMP-021 | User enable action on detail                                  |
| IMP-022 | Roles list + create + custom permission replace               |
| IMP-023 | Memberships list with status filter                           |
| IMP-025 | Academic delete 409 dependents listing                        |
| IMP-026 | Org-scoped user-role assign                                   |
| IMP-027 | Shared admin primitives (Banner, ResourceList, ConfirmDialog) |
| IMP-028 | AdminTable for Users/Students ops lists                       |
| IMP-029 | Grouped AdminShell nav IA for tablet                          |
| IMP-030 | Load more cursor pagination on admin registries               |
| IMP-033 | AdminShell /auth/me gate + permission-filtered nav            |
| IMP-034 | ConfirmDialog replaces window.confirm (destructive admin)     |
| IMP-035 | Central adminFriendlyMessage error mapper                     |
| IMP-031 | Admin cross-links (student ↔ enrollment/fees/guardian)        |

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
| 1.20 | 2026-07-27 | IMP-034 ConfirmDialog replaces window.confirm (destructive admin)   |
| 1.21 | 2026-07-28 | IMP-035 central adminFriendlyMessage error mapper                   |
| 1.22 | 2026-07-28 | IMP-031 admin cross-links (student detail + invoice guardians)      |
