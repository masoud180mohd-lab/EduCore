# DSF-KIT-002 — Portal Chrome & Brand Deepening (Multi-Portal)

| Field     | Value                                                                                 |
| --------- | ------------------------------------------------------------------------------------- |
| Freeze ID | `DSF-KIT-002`                                                                         |
| Version   | `1.1`                                                                                 |
| Date      | 2026-08-20                                                                            |
| Status    | **Accepted — Owner GO in session 2026-08-15** (gate form per SOLO-GOV-003)            |
| Authority | Owner + AI (SOLO-GOV-002/003)                                                         |
| Governing | SPEC-PORTALS-001 v1.0 · DSF-KIT-001 v1.5 · 07_DESIGN_SYSTEM · 32_ACCESS_CONTROL_BIBLE |
| Amends    | DSF-KIT-001 §4 (role navigation model) — see §6 below                                 |

**Honesty:** Chrome/token contract only. Screen inventories stay in slice DSFs (DSF-007/008/009 pending). Accepting this freeze does **not** authorize feature coding — each phase still needs its ACF/DBF/SRS gates per SPEC-PORTALS-001 §8. Production/public pilot remains NO GO.

## 1. Portal shell inventory

| Shell                       | Route namespace                         | Users                          | Nav pattern                                                         | Density                                   |
| --------------------------- | --------------------------------------- | ------------------------------ | ------------------------------------------------------------------- | ----------------------------------------- |
| `PlatformShell`             | `/platform`                             | Super Admin (Support later)    | Digii hybrid (v1.1)                                                 | Dense tables                              |
| `AdminShell` _(existing)_   | `/t/:id/admin`                          | Office staff                   | Digii hybrid (v1.1); IA groups unchanged                            | Dense tables                              |
| `HeadShell`                 | `/t/:id/head`                           | Headmaster, Deputy (delegated) | Digii hybrid, decision-first                                        | Medium — KPIs + lists                     |
| `TeacherShell` _(reshaped)_ | `/t/:id/teacher`                        | Teachers                       | Mode tabs (Darasa/Somo) + bottom-safe mobile column                 | Mobile-first, max `--content-max-teacher` |
| `StudentShell`              | `/t/:id/student`                        | Students (Phase 4)             | Bottom tabs                                                         | Mobile-first, simple                      |
| `ParentShell` _(existing)_  | `/t/:id/parent`                         | Parents                        | Header + child switcher + tabs                                      | Mobile-first, simple                      |
| Auth chrome                 | `/login`, tenant picker, portal chooser | All                            | Centered card form; subtle atmosphere OK; no marketing hero collage | —                                         |

New shells reuse DSF-KIT-001 tokens (§2 / §2.1), primitives, and operational states (§5–§8 of that freeze). Implementation stack: Tailwind + shadcn per DSF-KIT-001 v1.7.

### 1.1 Digii hybrid chrome (v1.1 — Owner GO 2026-08-20)

Reference: EduNexus `PortalShell` (institutional Digii-style). Binding for Platform / Admin / Head rail portals:

1. **Sticky top institutional bar** — filled with `--color-accent` (or `--portal-accent` for the thin identity strip only); brand mark + wordmark; optional search on md+; locale/theme/logout controls on primary-foreground.
2. **Content grid** — `max-w-7xl`, left column (~260px) + main. Left column: profile/context **card** + nav links (active = primary fill). Not the legacy full-height dark `#12202b` rail as the only chrome.
3. **Mobile** — hamburger / Sheet for left column; top bar remains.
4. **Legacy** `.admin-console*` dark-rail CSS may remain until a page migrates; new work targets Digii hybrid.

Teacher / Student / Parent keep mobile patterns in §3; they may share the top institutional bar where it aids brand consistency without mixing capture chrome into rail portals.

## 2. Portal identity model

One brand, one token family (teal/ink of DSF-KIT-001 §2 stays canonical). Portal identity is carried by **three cues only** — wordmark suffix, portal chip, and identity tint:

1. **Wordmark suffix:** `EduCore` + portal name (e.g. `EduCore · Mwalimu Mkuu`) in the shell top bar.
2. **Portal chip:** small labeled chip in the utility bar naming the active portal; doubles as the portal switcher trigger when the user holds >1 capability.
3. **Identity tint `--portal-accent`:** used **only** for the portal chip, active-nav marker, and shell top strip. All operational controls (buttons, links, focus) keep shared `--color-accent #0f6b5c`.

| Portal         | `--portal-accent` | Hue rationale                         |
| -------------- | ----------------- | ------------------------------------- |
| Platform       | `#134a6d`         | deep sea blue — systemic authority    |
| Office (Admin) | `#0f6b5c`         | anchor teal (brand baseline)          |
| Head           | `#8a5a13`         | amber ink — decision gravitas         |
| Teacher        | `#4f6b0f`         | olive green — chalk/classroom         |
| Student        | `#44546b`         | slate — calm, read-only               |
| Parent         | `#6b0f3f`         | plum — distinct from danger `#b42318` |

All six pass ≥4.5:1 on `--color-surface` white for text-size usage. Banned looks from DSF-KIT-001 §1 remain banned. Any further per-portal theming requires a DSF-KIT amend.

## 3. Nav patterns (binding)

- **Rail portals** (Platform/Admin/Head): Digii hybrid (§1.1) — top institutional bar + left nav card column; grouped nav IA unchanged. Mobile <768px = Sheet/hamburger for left column. Nav groups come from SPEC-PORTALS-001 §3; screen-level items land in slice DSFs.
- **Mobile portals** (Teacher/Student/Parent): single column; Teacher gets persistent mode tabs (Darasa/Somo) directly under the top bar; Student gets bottom tab bar (`Leo · Mahudhurio · Matokeo · Ada · Ujumbe`); Parent keeps header + child switcher.
- Offline/sync strip (TeacherShell) is always visible during capture flows.
- Never mix capture chrome into rail portals or rail chrome into mobile portals (carries over from DSF-KIT-001 §4 rule 3).

## 4. Post-login routing rule (replaces DSF-KIT-001 §4 rule 2)

Adopted verbatim from SPEC-PORTALS-001 D2:

1. AuthN → MFA per policy (platform roles: hard, always).
2. Platform capability resolved **before** tenancy; platform users land `/platform`.
3. \>1 tenant membership → tenant picker.
4. Within tenant: exactly one portal capability → auto-enter; >1 → persisted last-portal preference wins; first login → portal chooser ordered by capability priority (Platform > Head > School Admin > Teacher > Student > Parent).
5. Entering `/platform`, Head, School Admin, or any support session emits an audit event.

Username-pattern routing is forbidden. API stays AuthZ truth; nav renders only reachable domains.

## 5. Portal switcher (replaces IMP-050 workspace switcher)

- Trigger: portal chip in utility bar; lists only portals the user's **real capabilities** reach (no owner/admin blanket preview).
- Switching to a privileged portal is explicit + audited; preference persists per user × tenant (server-side).
- The disabled "Student" hint chip is retired (real Student portal arrives Phase 4).

## 6. DSF-KIT-001 amendments enacted by this freeze

| DSF-KIT-001 item                                                                        | Disposition                                  |
| --------------------------------------------------------------------------------------- | -------------------------------------------- |
| §4 rule 2 (post-login `/auth/me` → admin/teacher/parent home)                           | **Replaced** by §4 above                     |
| §4 IMP-050 note (workspace switcher + student disabled hint)                            | **Retired**, replaced by §5 above            |
| Everything else (tokens, type, layouts, components, states, a11y, offline, i18n, theme) | **Unchanged and binding** for all new shells |

## 7. Acceptance

- [x] Owner GO in session (2026-08-15) — SOLO-GOV-003 gate form
- [x] Consistent with SPEC-PORTALS-001 v1.0 (D2/D3, Q1–Q10 defaults)
- [ ] Slice DSF-007 (Platform), DSF-008 (Head), DSF-009 (Student) — required before those shells' screens are coded
- [ ] ACF for portal preference + switch-audit events — required before routing code

## Amendments

| Ver | Date       | Notes                                                                                                                         |
| --- | ---------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1.0 | 2026-08-15 | Initial portal chrome freeze from SPEC-PORTALS-001 Phase 0                                                                    |
| 1.1 | 2026-08-20 | Owner GO: Digii hybrid chrome (EduNexus reference) for Platform/Admin/Head; pairs with DSF-KIT-001 v1.7 Tailwind/shadcn stack |
