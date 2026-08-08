# DSF-KIT-001 — Kit-wide Design System Freeze v1.0

| Field       | Value                                                                 |
| ----------- | --------------------------------------------------------------------- |
| Freeze ID   | `DSF-KIT-001`                                                         |
| Version     | `1.0`                                                                 |
| Date        | 2026-08-08                                                            |
| Status      | **Accepted (solo-operator)** — 2026-08-08 (`GO DSF-KIT`)              |
| Authority   | Solo-operator provisional (SOLO-GOV-001)                              |
| Governing   | `07_DESIGN_SYSTEM.md` · Architecture Freeze Gate 3 · B-03 · DSF-001…006 |
| Supersedes  | B-03 “kit-wide not accepted” residual — **this freeze closes it**     |

**Honesty:** Accepted under SOLO-GOV-001. Not independent Design peer review. Does **not** flip unrestricted production GO. Slice DSFs remain the screen inventories; this freeze is the **shared chrome contract**.

## Objective

Satisfy Architecture Freeze **Gate 3** with a single kit-wide package:

1. Shared layout rules + design tokens  
2. Role navigation model  
3. Core components + operational states  
4. Accessibility + offline baseline  

## Relationship to slice DSFs

| Layer | Authority |
| --- | --- |
| **DSF-KIT-001** | Tokens, shells, nav model, shared primitives, a11y/offline |
| **DSF-001…006** | Screen lists, domain copy, route-level inventory (still in force) |
| Conflict | Kit tokens/shell rules win; amend slice DSF for screen scope |

New role UI still needs a **slice DSF** (or amend) naming screens — kit freeze alone does not invent product routes.

## 1. Design principles (binding)

From `07_DESIGN_SYSTEM.md`, binding for all roles:

- Operations platform — not marketing  
- Mobile-first teacher/parent; dense readable admin/finance  
- Common tasks visible; offline state always clear  
- Kiswahili + English without layout break  
- Low-end Android first  
- **Avoid:** purple-on-white AI defaults, terracotta/cream brochure look, broadsheet newspaper chrome, decorative heroes, glow/pill spam  

## 2. Shared design tokens (single source)

Canonical CSS variables (from DSF-001; all slices reuse):

| Token | Role | Value |
| --- | --- | --- |
| `--color-bg` | Page background | `#f4f6f8` |
| `--color-surface` | Panels / tables | `#ffffff` |
| `--color-ink` | Primary text | `#1a2332` |
| `--color-muted` | Secondary text | `#5c6b7a` |
| `--color-border` | Rules | `#d5dde5` |
| `--color-accent` | Primary actions | `#0f6b5c` |
| `--color-accent-ink` | On accent | `#ffffff` |
| `--color-danger` | Errors / destructive | `#b42318` |
| `--color-warn` | Late / offline / caution | `#b54708` |
| `--color-ok` | Success / present | `#067647` |
| `--space-1`…`--space-6` | 4 / 8 / 12 / 16 / 24 / 32 px | |
| `--font-sans` | UI | `"Source Sans 3", "Segoe UI", system-ui, sans-serif` |
| `--radius` | Controls | `6px` |
| `--focus-ring` | Focus | `2px solid #0f6b5c` |
| `--content-max-teacher` | Teacher column | `40rem` |
| `--content-max-admin` | Admin / parent | `48rem`–`56rem` |

### Type scale

| Role | Size / weight |
| --- | --- |
| Title | 1.25rem / 600 |
| Body | 1rem / 400 |
| Meta | 0.875rem / 400 |
| Touch target | **≥ 44×44 px** for primary actions / toggles |

Changing tokens requires **DSF-KIT amend** (not silent Tailwind/shadcn swap).

## 3. Layout rules

| Shell | Layout |
| --- | --- |
| **TeacherShell** | Mobile column; bottom or compact top nav; max `--content-max-teacher` |
| **AdminShell** | Header brand = school name (`GET /tenants/current`); grouped top nav; denser tables |
| **ParentShell** | Simple header; Home + Sign out; admin density max-width |
| **Login / MFA** | Centered narrow form; clear errors; no marketing hero |

- No inset “dashboard card collage” for primary capture flows  
- Cards only when they contain a user interaction that needs containment  
- One job per primary view (list → detail → confirm)  

## 4. Role navigation model

| Role | Shell | Primary nav (capability-filtered) |
| --- | --- | --- |
| **Teacher / staff** | TeacherShell | Attend · Sessions · Marks · Logout (per DSF-001/003) |
| **Admin / head** | AdminShell | Grouped: Registry · Access · Academic · Fees · Notifications · Settings (DSF-002 IMP-029) |
| **Bursar** | AdminShell | Fees-focused; same shell; nav filtered by `finance.*` |
| **Parent / guardian** | ParentShell | Home (fees) · Sign out (DSF-006) |

Rules:

1. Nav shows only domains the actor can reach (API remains AuthZ truth).  
2. Post-login routing: `/auth/me` → admin vs teacher vs parent home (existing prefs).  
3. Do not mix teacher capture chrome inside AdminShell or parent chrome inside teacher.  

## 5. Core components (kit inventory)

Shared primitives (implementations may live under `apps/web/src/components/`):

| Component | Purpose |
| --- | --- |
| `Button` | primary / secondary / danger |
| `TextField` | labeled inputs |
| `Banner` | error / info / offline / warn |
| `StatusChip` | present/absent/late/excused/open/closed/paid/… |
| `EmptyState` | next action clear |
| `ConfirmDialog` | Esc/Cancel focus; danger for destructive |
| `AdminPageHeader` | title + actions |
| `ResourceList` / `AdminTable` | loading / empty / error / forbidden + optional Load more |
| `ResourceListPagination` | cursor “Load more” |
| Shells | `TeacherShell`, `AdminShell`, `ParentShell` |

Domain rows (e.g. `StudentMarkRow`) stay in slice DSFs.

## 6. Operational states (required)

Every list/detail primary surface must define:

| State | UX |
| --- | --- |
| **Loading** | Non-blocking skeleton or inline busy; no fake data |
| **Empty** | Why empty + one next action |
| **Error** | Friendly copy; retry when safe |
| **Forbidden (403)** | Role-appropriate message (`adminFriendlyMessage` pattern) |
| **Offline** | Explicit offline banner; do not claim sync success |
| **Success** | Quiet confirmation (banner/toast); no confetti |

### Auth / session copy (kit default)

| Condition | Copy direction |
| --- | --- |
| 401 | Sign in again |
| 403 | You do not have access for this school / action |
| Network | You are offline — … (queue honesty per slice) |

### Status language

Prefer precise kit statuses from `07_DESIGN_SYSTEM.md` (Draft, Pending payment, Paid, Synced, Sync failed, Conflict, …).

## 7. Accessibility baseline

Target **WCAG 2.1 AA** for primary flows:

- Labeled controls; visible `:focus` (`--focus-ring`)  
- Keyboard-operable toggles and dialogs  
- Sufficient contrast on accent / danger / ok  
- Dialogs: focus trap, Esc, restore focus on close  
- Do not convey meaning by color alone (`StatusChip` text/icon)  

## 8. Offline baseline

- Always show offline when disconnected  
- Never pretend server confirmation without accept  
- Full offline queue engine may be slice-scoped; kit requires **honest** unavailable copy when queue not enabled  

## 9. Auth storage (web)

v1 SPA: opaque Bearer in **sessionStorage** (not `localStorage`). Residual XSS — CSP follow-on. Never log tokens.

## 10. i18n

Layouts must not break for Kiswahili labels (wrap / allow slightly longer strings). String catalogs may land incrementally; freeze requires **no hard-coded English-only width assumptions** on primary buttons.

## Slice inventory (still governing screens)

| ID | Scope |
| --- | --- |
| DSF-001 | Teacher attendance |
| DSF-002 | Admin shell / guardians / academic / users |
| DSF-003 | Teacher marks |
| DSF-004 | Admin fees |
| DSF-005 | Guardian fees (admin compose) |
| DSF-006 | Parent portal |

## Explicit non-goals

- Redesigning all screens in this freeze document  
- Marketing site / brand landing  
- New component library (shadcn/MUI) adoption  
- Claiming independent design countersign  
- Production GO  

## Acceptance

- [x] Shared tokens + layout rules  
- [x] Role navigation model  
- [x] Core components + states  
- [x] A11y + offline baselines  
- [x] Slice DSFs retained for screen scope  
- [x] B-03 kit-wide residual closed **provisionally** under SOLO-GOV-001  

## Amendments

| Ver | Date | Notes |
| --- | --- | --- |
| 1.0 | 2026-08-08 | Initial kit-wide freeze from DSF-001…006 synthesis |

## Related

- Decision posture history: `docs/engineering/decisions/B-03-design-system-freeze-posture.md`  
- Task: `docs/engineering/task-records/DSF-KIT-001.md`  
