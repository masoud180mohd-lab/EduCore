# DSF-002 — Admin shell + Guardians UI (provisional)

| Field     | Value                                                       |
| --------- | ----------------------------------------------------------- |
| Freeze ID | `DSF-002`                                                   |
| Version   | `1.0`                                                       |
| Date      | 2026-07-21                                                  |
| Audience  | School admin / headmaster (desktop-first, usable on tablet) |
| Authority | Solo-operator provisional (SOLO-GOV-001)                    |

**Honesty:** Provisional design-system slice for IMP-007 only. Does **not** accept kit-wide Design System Freeze. Reuses DSF-001 tokens; defines admin chrome and guardians registry screens.

## Goal

Calm operations shell for school admins: school overview, staff directory, organizations, students, guardians, and tenant settings — against existing Nest APIs (ACF-001/002) plus guardians ACF-010.

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
2. **Admin home** — school name + short links (Users, Orgs, Students, Guardians, Settings)
3. **Users list** — `GET /users` (search optional)
4. **Organizations list** — `GET /organizations`
5. **Students list** — `GET /students` (admin read; create deferred unless trivial)
6. **Tenant settings read** — `GET /tenant-settings`
7. **Guardians list** — `GET /guardians`
8. **Guardian detail** — get + linked students; create guardian; link/unlink student

## Component inventory (this slice)

- `AdminShell` (nav: Home / Users / Orgs / Students / Guardians / Settings / Logout)
- Shared banners, buttons, fields from DSF-001 language
- `ResourceList` pattern (loading / empty / error / forbidden)
- Guardian form (displayName, optional phone/email)
- Link-student control (student picker + relationship type)

## AuthZ UX

- Unbound tenant → `/login`
- 401 → Sign in again
- 403 → “You do not have access for this action.”
- Staff without admin perms → teacher shell only (no admin nav)

## Non-goals

- Parent portal, marks, AI
- Fees / bursar chrome — deferred to **DSF-004** (IMP-010)
- Roles/permissions admin CRUD (`/roles` HTTP missing)
- MFA enrollment
- Full offline sync
- Nested PII expansions on student GET
- Marketing dashboards / charts

## Auth storage

Same as DSF-001: Bearer + `X-Tenant-Id` in `sessionStorage` until httpOnly cookie path exists. Threat: XSS can read tokens — mitigate with CSP later; never `localStorage`.

## Solo-operator honesty

Accepted under acting seats only; revise when a second review seat exists.
