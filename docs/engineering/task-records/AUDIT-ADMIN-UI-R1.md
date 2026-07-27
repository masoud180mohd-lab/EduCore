# AUDIT-ADMIN-UI-R1 — Admin UI maturity & design review

| Field     | Value                                            |
| --------- | ------------------------------------------------ |
| Audit ID  | `AUDIT-ADMIN-UI-R1`                              |
| Date      | 2026-07-27                                       |
| Mode      | Read-only · Evidence-based · No implementation   |
| Scope     | Admin UI foundation → current (through IMP-020+) |
| Authority | Solo-operator provisional (SOLO-GOV-001)         |

**Inspected:** `apps/web/src/app/t/[tenantId]/admin/**`, `AdminShell.tsx`, `tokens.css`, `lib/api/client.ts`, `lib/finance/money.ts`, DSF-001/002/004, EduCore/07 + /09, task records IMP-007…IMP-026. **`npm run check` was not run** (audit-only pass).

---

## 1. Executive verdict

**Ready for demo / soft pilot with a guided operator — not ready for unsupervised production school ops.**

Capability trajectory is real: from IMP-007’s thin AdminShell+Guardians to a full domain map (Users, Memberships, Orgs, Students, Guardians, Roles, Academic+enrollments, Fees, Settings) through IMP-020 and beyond (IMP-021–026). Workflows exist end-to-end for bursar office cash and headmaster registry jobs.

Professionalism is **usable internal-tool floor**, not shippable SaaS polish: shared CSS classes + tokens help calm ops aesthetic, but there is no component library, lists are card stacks without pagination, confirms are `window.confirm`, nav is not permission-aware, and kit stack (Tailwind/shadcn/TanStack Query) is absent. Relative to EduCore’s calm dense ops target the gap is **Medium**. Digii-class critique would hit density, tables, and chrome consistency first — not missing domains.

---

## 2. Surface inventory

| Domain        | Routes (under `/t/[tenantId]/admin`)                           | DSF ref           | Maturity         | Notes                                                                              |
| ------------- | -------------------------------------------------------------- | ----------------- | ---------------- | ---------------------------------------------------------------------------------- |
| Shell / home  | `/`, nav chrome                                                | DSF-002           | Usable           | School name in header (IMP-017); home = 9 static cards; no KPIs                    |
| Users         | `/users`, `/users/[userId]`                                    | DSF-002           | Usable           | Invite, disable/enable, membership lifecycle, role assign; most mature detail page |
| Memberships   | `/memberships`                                                 | DSF-002           | Usable           | Status filter (IMP-023); actions live on user detail                               |
| Organizations | `/organizations`, `/organizations/[organizationId]`            | DSF-002           | Usable           | Create/edit/deactivate                                                             |
| Students      | `/students`, `/students/[studentId]`                           | DSF-002           | Usable           | Create/edit; no delete; no confirm on status                                       |
| Guardians     | `/guardians`, `/guardians/[guardianId]` (+ fees compose)       | DSF-002 / DSF-005 | Usable           | Links, portal bind; UUID paste fallback when picker 403s                           |
| Roles         | `/roles`, `/roles/[roleId]`                                    | DSF-002           | Usable           | Custom role perms; system grants read-only (IMP-022)                               |
| Academic      | `/academic` + years/terms/classes/streams/subjects/enrollments | DSF-002           | Usable           | PATCH/delete/reparent; `DeleteDependentsBanner` (IMP-025)                          |
| Fees          | `/fees`, structures/invoices/receipts (+ details)              | DSF-004           | Usable           | Honest “MoMo not enabled”; `formatTzsMinor`; void/pay/reverse/reconcile            |
| Settings      | `/settings`                                                    | DSF-002           | Prototype→Usable | Known keys + raw JSON textarea (developer escape hatch)                            |

**Maturity key:** Prototype = scaffolding · Usable = operator can complete job with roughness · Polished = production-grade density/states/a11y. **No admin surface scored Polished.**

---

## 3. Rubric scores

Equal weights (no justification to overweight visual over trust for this pass).

| Rubric                       | Score (1–5) | One-line justification                                                             |
| ---------------------------- | ----------- | ---------------------------------------------------------------------------------- |
| R1 Visual professionalism    | **3**       | Calm teal/ink tokens; still student-demo density (cards, inline styles, no tables) |
| R2 IA & workflow fit         | **3**       | Hub→list→detail exists; flat 10-item nav; weak cross-links (student↔fees)          |
| R3 Design-system consistency | **2**       | Tokens shared; DSF “ResourceList” not a real component; per-page hand-roll         |
| R4 Interaction states        | **3**       | Loading/empty/error often present; no pagination/toasts/skeletons                  |
| R5 Accessibility & input     | **2**       | Labels + focus-ring + 44px `.btn`; native confirms; nav wrap risk on tablet        |
| R6 Security & trust UX       | **3**       | API is AuthZ truth; MoMo honesty; no admin route permission gate                   |
| R7 Product fit (EduCore SMS) | **3**       | Ops-not-marketing OK; under-dense for bursar; no i18n readiness                    |
| **Overall (mean)**           | **2.7**     | Demo / soft pilot; polish track required before production                         |

### Comparative judgment

| Baseline                                 | Verdict                                                                                        |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| vs IMP-007 first AdminShell              | **Better** — domains, fees money path, academic delete dependents, membership lifecycle, roles |
| vs EduCore target (07/09 dense ops SaaS) | **Medium gap** — aesthetic direction right; density, shared primitives, kit stack missing      |
| vs production school software            | **Ready with polish** for guided pilot; **Not ready** for unsupervised bursar floor            |

---

## 4. Strengths (evidence-backed)

1. **Calm ops palette, not marketing** — `tokens.css` teal accent `#0f6b5c`, muted ink, no purple-glow hero (`apps/web/src/styles/tokens.css:1-21`). Matches EduCore/07 “avoid decorative complexity.”
2. **Domain coverage matches DSF-002/004 intent** — Nav lists Home…Fees…Settings (`AdminShell.tsx:58-69`); Fees hub explicitly states MoMo off (`fees/page.tsx:16-18`).
3. **Money path is more trustworthy than average CRUD** — `formatTzsMinor` / `parseMajorToMinor` enforce minor units (`lib/finance/money.ts`); balance treated as API-derived.
4. **AuthZ honesty where it matters** — IMP-026 UI discloses org-scope assignment is metadata-only; Fees reconcile 403 copy; API failures surface as banners rather than fake client “success.”
5. **Destructive money/membership actions ask before mutate** — `window.confirm` on void/reverse/suspend/unbind (imperfect a11y, but present).
6. **Academic 409 dependents are actionable** — `DeleteDependentsBanner` lists blockers with admin links (IMP-025) — rare designed shared component.
7. **Touch-minded primary controls** — `.btn` / inputs `min-height: 2.75rem` (~44px) (`tokens.css:114-128`).
8. **Trajectory discipline** — Incremental IMPs expanded Admin without a marketing redesign; DSF revisions track programs through 1.14.

---

## 5. Gaps & weaknesses (severity)

| ID  | Severity | Area               | Finding                                                                                                                  | Evidence                                                                 | User impact                                                                                                  |
| --- | -------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| G1  | P0       | Trust / AuthZ UX   | AdminShell gates session+tenant only — not admin role/permissions; full nav shown to any signed-in user who hits the URL | `AdminShell.tsx:29-34`, `58-69`                                          | Teacher/parent who knows the URL sees Admin chrome; confusion + false capability impression (API still 403s) |
| G2  | P0       | Workflow / data    | No pagination / “more rows” affordance; lists hard-cap `limit=50`/`100`                                                  | e.g. `students`/`users`/`guardians`/`organizations` list fetches         | Large schools silently miss students/invoices beyond first page                                              |
| G3  | P1       | Design system      | DSF-002 invents `ResourceList` pattern; no shared React primitive — ~25 pages copy fetch/error JSX                       | DSF-002 §Component inventory vs `apps/web/src/components/` (shells only) | Inconsistent empty/403 copy; high change cost                                                                |
| G4  | P1       | Visual / IA        | Ops lists use **card stacks**, not tables; fights EduCore/07 “Tables for operational lists”                              | `admin/page.tsx` cards; list pages `ul.list` + `Link.card`               | Scanning/comparison slow for bursar/headmaster                                                               |
| G5  | P1       | Interaction        | All confirms are `window.confirm` — not styleable/accessible modals                                                      | Fees invoice void; users disable/suspend; academic delete                | Tablet/keyboard UX poor; looks prototype                                                                     |
| G6  | P1       | Consistency        | 8+ near-duplicate `*Message(err)` mappers; inline `style={{}}` bypasses tokens                                           | `teacherFriendlyMessage` wrappers; 32 files with inline styles           | Drift between domains; spacing/typography uneven                                                             |
| G7  | P1       | Settings           | Raw JSON textarea shipped to operators                                                                                   | `settings/page.tsx:188-196`                                              | Risk of broken tenant settings; feels developer-tool                                                         |
| G8  | P1       | Guardians          | “Paste user UUID” advanced bind when `user.read` denied                                                                  | `guardians/[guardianId]/page.tsx` advanced UUID path                     | Feels insecure/unfinished; operators stuck without support                                                   |
| G9  | P2       | Performance        | Duplicate `/tenants/current` on home (shell + page)                                                                      | `AdminShell.tsx:39` + `admin/page.tsx:26`                                | Extra latency on weak networks                                                                               |
| G10 | P2       | Kit drift          | EduCore/09 specifies Tailwind + shadcn + TanStack Query; web uses hand CSS + raw `useEffect` fetch                       | `EduCore/09` vs `apps/web/package.json`                                  | Future agents/humans pull wrong stack; no shared query cache                                                 |
| G11 | P2       | i18n / product fit | Hardcoded English strings; no translation keys                                                                           | All admin pages                                                          | Kiswahili layout readiness blocked                                                                           |
| G12 | P2       | Chrome             | Flat 10-link top nav will wrap/crowd on tablet                                                                           | `AdminShell.tsx` + `.top-nav nav` flex                                   | Tablet office use degrades first                                                                             |
| G13 | P2       | Cross-workflow     | Weak student→enrollment→invoice deep links from registries                                                               | Students detail vs Fees invoice create pickers                           | Headmaster hunts across hubs                                                                                 |

---

## 6. Design-fit assessment

**Partial** match to EduCore/07 + /09 + DSF-002/004.

| Intent                                     | Fit                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------- |
| Calm ops, not marketing                    | **Yes** — restrained color, no hero                                       |
| Dense admin dashboards / tables            | **No** — sparse card lists dominate                                       |
| Shared banners/buttons/fields language     | **Partial** — CSS classes exist; no React primitives                      |
| ResourceList loading/empty/error/forbidden | **Partial** — pattern copied per page, uneven 403 wording                 |
| Kit Tailwind/shadcn/TanStack               | **No** — intentional provisional debt; document honestly                  |
| Fees money precision                       | **Yes** — DSF-004 helpers followed                                        |
| Role-specific navigation                   | **Partial** — post-login routing only; AdminShell not permission-filtered |
| Avoid decorative complexity                | **Yes** — but under-building density is the bigger miss                   |

---

## 7. Recommended improvement roadmap

### T1 Visual / system polish

| Increment               | Goal                                                                                                     | Why now                                          | Out of scope        | Acceptance                                                 | Suggested ID                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------- | ---------------------------------------------------------- | ------------------------------- |
| Shared admin primitives | Extract `AdminPageHeader`, `ResourceList`, `StatusChip`, `ConfirmDialog`, `Banner` using existing tokens | Unlocks every later page without redesign        | Tailwind migration  | 3 domains refactored to primitives; no visual brand change | **IMP-027-UI-admin-primitives** |
| Ops tables + density    | Replace card lists with dense table rows for Users/Students/Invoices/Receipts                            | Matches EduCore/07; biggest professionalism jump | New APIs            | Tables with status chips; ≥44px primary actions retained   | **IMP-028-UI-admin-tables**     |
| Nav IA for tablet       | Group nav (Registry / Academic / Fees / Access) or secondary sidebar                                     | 10 flat links wrap on tablet                     | Permission redesign | Usable at 768px width without overflow                     | **IMP-029-UI-admin-nav**        |

### T2 Workflow completeness

| Increment              | Goal                                                                     | Why now                          | Out of scope        | Acceptance                                                                   | Suggested ID                    |
| ---------------------- | ------------------------------------------------------------------------ | -------------------------------- | ------------------- | ---------------------------------------------------------------------------- | ------------------------------- |
| List pagination        | Cursor/next UI on all admin lists                                        | P0 data honesty for real schools | Virtualization      | “Load more” or next cursor when `page.nextCursor` set; never silent truncate | **IMP-030-UI-admin-pagination** |
| Cross-links            | Student detail → enrollments + open invoices; invoice → student/guardian | Reduces hunting                  | Parent portal       | Documented deep links in DSF-002 amend                                       | **IMP-031-UI-admin-crosslinks** |
| Settings operator form | Hide raw JSON behind “Advanced” or staff-only                            | Stops accidental tenant breakage | New settings schema | Default form = known keys only                                               | **IMP-032-UI-settings-safe**    |

### T3 Trust / a11y / states

| Increment                  | Goal                                                                                           | Why now                  | Out of scope                  | Acceptance                                                           | Suggested ID                    |
| -------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------ | ----------------------------- | -------------------------------------------------------------------- | ------------------------------- |
| Admin route honesty        | After session bind, `/auth/me` without admin-capable perms → redirect teacher/parent + explain | Closes AuthZ theater gap | Server middleware AuthZ       | Direct `/admin` URL does not show full privileged nav for staff-only | **IMP-033-UI-admin-authz-gate** |
| Confirm modal + focus trap | Replace `window.confirm` for money + membership destructive actions                            | A11y + professionalism   | Generic modal library rewrite | Keyboard Esc/Enter; focus return; danger styling                     | **IMP-034-UI-confirm-modal**    |
| Central error mapper       | One `adminFriendlyMessage(domain)`                                                             | Stops 403 wording drift  | i18n framework                | Single module; domain overrides only where needed                    | **IMP-035-UI-error-copy**       |

### T4 Do not do yet

- Real MoMo / parent pay production cutover (PAY-PROVIDER-001)
- Marketing redesign / purple SaaS makeover
- Kit-wide DSF acceptance theater or forced Tailwind rewrite in one PR
- Headmaster analytics dashboards / charts (EduCore/07 headmaster KPIs) before primitives + pagination
- Fake client-side AuthZ that hides buttons without API truth
- Big-bang redesign without DSF amend

**Recommended order:** IMP-033 (authz gate) → IMP-027 (primitives) → IMP-030 (pagination) → IMP-028 (tables) → IMP-034 (confirm) → then settings/cross-links/nav.

---

## 8. Explicit non-goals confirmed

- No MoMo vendor UI until superseding provider brief
- No client AuthZ as security boundary (API remains truth)
- No big-bang visual redesign without DSF amend
- No claim that Admin UI is “Polished” or production-complete
- CORS fix in `apps/api/src/main.ts` is out of this audit’s scoring (API infra); noted as enabling UI login only

---

## 9. npm / evidence notes

| Item                                | Status                                                                                                                                                                                                                                         |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code / DSF / task record inspection | Done (paths cited above)                                                                                                                                                                                                                       |
| Live browser walkthrough this pass  | Not required; prior session saw login + admin chrome                                                                                                                                                                                           |
| `npm run check`                     | **Not run** — do not claim green                                                                                                                                                                                                               |
| Five-axis (admin web)               | Correctness: money helpers sound; Readability: high duplication; Architecture: page-per-feature without shared list primitive; Security: sessionStorage + missing route gate (UX); Performance: uncapped mental model + duplicate tenant fetch |

### Doubt checks (adversarial answers)

1. **Bursar first 5 minutes:** Flat nav overload; Fees ok once found; invoice list as cards hard to scan; may not realize list is capped at 50.
2. **Looks done but shallow:** Home hub cards (static directory); Settings (JSON trap); Memberships list (actions elsewhere).
3. **Most prototype:** Settings JSON + guardian UUID paste. **Most professional:** Fees money path + Users detail lifecycle + academic dependents banner.
4. **Remove borders/shadows/cards?** Yes for list pages — cards add chrome without comparison value; keep surface cards only for hubs.
5. **AdminShell density:** Content max-width 56rem is fine; **nav is cramped horizontally**, body often too sparse vertically (card gap).
6. **Fees vs Users/Academic trust:** Fees money UX is **more trustworthy** (minor units, MoMo honesty). Users detail is **most feature-complete**. Academic delete dependents is best shared pattern.
7. **Digii-class first critique:** “Where are the tables and filters?” then “Why can every role see Admin nav?”
8. **Chrome vs workflow:** Risk of polishing home cards before pagination/tables — roadmap above prioritizes gate + primitives + pagination over chrome cosmetics.

---

## Residual honesty

Admin UI is a **successful capability build** with a **Medium design-system debt**. Next value is not another domain — it is **trust gate + shared list/table primitives + pagination**. Preserve the calm EduCore aesthetic; do not “modernize” into marketing UI.
