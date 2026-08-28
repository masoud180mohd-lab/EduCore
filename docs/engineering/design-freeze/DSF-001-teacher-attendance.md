# DSF-001 — Teacher Attendance UI (provisional)

| Field     | Value                                    |
| --------- | ---------------------------------------- |
| Freeze ID | `DSF-001`                                |
| Version   | `1.2`                                    |
| Date      | 2026-08-20                               |
| Audience  | Teacher / staff (mobile-first)           |
| Authority | Solo-operator provisional (SOLO-GOV-001) |

**Honesty:** This is a **provisional** design-system slice for IMP-006 only. It does **not** accept a kit-wide Design System Freeze or production chrome sign-off.

## Goal

Calm, fast attendance capture for teachers on low-end phones. Operations UI — not marketing.

## Tokens (CSS variables)

| Token                   | Role                         | Value                                                |
| ----------------------- | ---------------------------- | ---------------------------------------------------- |
| `--color-bg`            | Page background              | `#f4f6f8`                                            |
| `--color-surface`       | Panels                       | `#ffffff`                                            |
| `--color-ink`           | Primary text                 | `#1a2332`                                            |
| `--color-muted`         | Secondary text               | `#5c6b7a`                                            |
| `--color-border`        | Rules                        | `#d5dde5`                                            |
| `--color-accent`        | Primary actions              | `#0f6b5c`                                            |
| `--color-accent-ink`    | On accent                    | `#ffffff`                                            |
| `--color-danger`        | Errors / absent              | `#b42318`                                            |
| `--color-warn`          | Late / offline               | `#b54708`                                            |
| `--color-ok`            | Present / success            | `#067647`                                            |
| `--space-1`…`--space-6` | 4 / 8 / 12 / 16 / 24 / 32 px |                                                      |
| `--font-sans`           | UI                           | `"Source Sans 3", "Segoe UI", system-ui, sans-serif` |
| `--radius`              | Controls                     | `6px`                                                |
| `--focus-ring`          | A11y                         | `2px solid #0f6b5c`                                  |

Avoid purple-on-white gradients, terracotta cream “AI brochure” looks, and decorative hero chrome.

## Type scale

- Title: 1.25rem / 600
- Body: 1rem / 400
- Meta: 0.875rem / 400
- Touch target min: 44×44 px for status toggles

## Screens in scope

1. **Login** — email + password; clear errors; MFA challenge → “not supported in v1”
2. **Teacher home (Class mode / Darasa)** — Leo (today) header; recent/open sessions; link to attendance picker
3. **Attendance picker** — class, optional stream, date → open/resume session
4. **Mark session** — roster + status toggles + Save + Close
5. **Closed session** — read-only marks

### Teacher Workspace modes (v1.2 — SPEC-PORTALS-001 D1)

`TeacherShell` hosts persistent **Darasa | Somo** mode tabs under the Digii top bar:

| Mode               | Nav focus         | Home                                 |
| ------------------ | ----------------- | ------------------------------------ |
| **Darasa (class)** | Sessions · Attend | today’s / recent attendance sessions |
| **Somo (subject)** | Marks             | open exams / marks entry (DSF-003)   |

- Tabs shown only for modes the actor can reach (`attendance.manage` → Darasa; `marks.manage` → Somo; `staff` role with neither listed perm → both until assignment-matrix API exists).
- One reachable mode → no tab strip (nav for that mode only).
- Default mode per SPEC D1 decision table; **last-used** persisted client-side per tenant in sessionStorage until portal-preference ACF ships (honest interim).
- Offline/sync strip remains binding for capture flows (queue may still be disabled).

## Component inventory (this slice only)

- `Button` (primary / secondary / danger)
- `TextField`
- `Banner` (error / info / offline)
- `StatusChip` (present / absent / late / excused / open / closed)
- `StudentMarkRow` (name + status control)
- `ShellNav` (Attend / Sessions / Logout)
- `EmptyState`
- **ConfirmDialog** for Close session (shared admin primitive; Esc / Cancel focus / danger)

## AuthZ / error UX

| API              | Teacher copy                            |
| ---------------- | --------------------------------------- |
| 401              | Sign in again                           |
| 403              | You do not have access for this school  |
| 404              | Session or student not found            |
| 409 closed       | Session is closed — marking disabled    |
| 400 non-enrolled | Student is not enrolled in this class   |
| Network offline  | You are offline — queue not enabled yet |

## Auth storage (threat note)

API issues opaque Bearer tokens (not httpOnly cookies for SPA). v1 stores `accessToken` + `tenantId` in **sessionStorage** (cleared when tab closes). Residual: XSS can read tokens — mitigate with CSP later; never `localStorage`; never log tokens.

## Non-goals

Admin dashboards, guardians, fees, marks entry, AI insights, full offline sync engine, nested student objects from attendance API (ids-only — compose names via students/enrollments).

## A11y

WCAG 2.1 AA target for primary flows: labeled controls, visible focus, keyboard-operable status toggles, sufficient contrast on accent/danger/ok.

## Binding contracts

ACF-009 attendance · ACF-008 enrollments · ACF-005 classes · ACF-002 students · Auth login/select-tenant.

## Revisions

| Ver | Date       | Notes                                                                     |
| --- | ---------- | ------------------------------------------------------------------------- |
| 1.0 | 2026-07-21 | Initial provisional freeze (IMP-006)                                      |
| 1.1 | 2026-07-30 | Close session uses ConfirmDialog (IMP-034 Wave X)                         |
| 1.2 | 2026-08-20 | Teacher Workspace Darasa/Somo mode tabs (SPEC D1 / Phase 2); Digii chrome |
