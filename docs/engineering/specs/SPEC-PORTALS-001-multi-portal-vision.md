# SPEC-PORTALS-001 — Multi-Portal Product Vision & UX Spec Gate

| Field     | Value                                                        |
| --------- | ------------------------------------------------------------ |
| Spec ID   | `SPEC-PORTALS-001`                                            |
| Version   | `1.0 (Accepted)`                                              |
| Date      | 2026-08-15                                                    |
| Status    | **Accepted — Owner GO in session 2026-08-15 (SOLO-GOV-003 gate form); all 10 Owner Questions resolved to their recommended defaults.** Feature coding still gated on §8 freezes. |
| Governing | SRS (34) · Constitution (03) · Architecture Freeze (38) · DSF-KIT-001 · Access Control Bible (32) · 07_DESIGN_SYSTEM |
| Honesty   | SOLO-GOV posture. Production/public pilot remains **NO GO**. This spec authorizes design work only. Reviewed by one fresh-context adversarial pass (findings: `SPEC-PORTALS-001-review-findings.md`); not independent human peer review. |

## 0. Scope of this document

Portal redesign + role experience expansion for EduCore. **No application code, no migrations, no UI implementation** flows from this document directly — it feeds DSF/ACF/DBF amendments which are the coding gates.

---

## 1. ASSUMPTIONS (sahihisha sasa, au tunaendelea nazo)

1. **One web app, many portals.** "Portal" = route namespace + shell inside the existing Next.js app (`/platform/...`, `/t/:tenantId/{admin,teacher,head,student,parent}`), not separate deployments. Isolation stays API/RLS-enforced, never frontend-enforced.
2. **SRS is the role universe.** Head Teacher = SRS "Headmaster"; Deputy = SRS "Deputy Headmaster". Academic Master, Registrar, Secretary, Accountant/Bursar map into School Admin portal via capability-filtered nav (no new portals for them).
3. **Student Portal is a proposed scope amendment.** Student is an SRS role, but MVP in-scope lists only "Parent portal basics". A student-facing portal (and any timetable module — absent from SRS entirely) requires an explicit SRS amendment before build.
4. **Platform billing = school→platform** subscriptions/plans/entitlements/metering. These appear in SRS *Functional Requirements → Tenant And Billing* but are **not on the SRS MVP In-Scope list** — so Phase 1a platform billing features are likewise a **proposed MVP-scope amendment**, held to the same discipline as the Student portal (see §8). Student-fees MoMo stays tenant-scope; no mixing.
5. **Platform Operations API is a skeleton** (verified: `apps/api/src/modules/platform-operations/` — DTOs deferred pending API Contract Freeze). Super Admin portal needs ACF + DBF before any endpoint/UI work.
6. **Identity stays Auth0 OIDC + opaque session** (ID-002/ID-003), sessionStorage bearer. **Platform MFA policy (single statement):** platform roles authenticate with MFA-hard at session start, always; destructive platform actions (suspend tenant, entitlement change) additionally require step-up re-verification. Tenant-side privileged MFA gates continue as already deployed.
7. **Kiswahili + English everywhere** from day one of each portal (existing EN/SW catalog carries forward; layouts must absorb longer SW strings per DSF-KIT-001 §10).
8. **All phases remain design/spec until readiness gates GO.** Phase-ordering claims about existing code (marks submit/approve flow exists; attendance exists) are assumptions to re-verify at each phase's freeze gate. Nothing in this spec claims production readiness.

---

## 2. DECISIONS

### D1 — Teacher Workspace moja, modes mbili (ACCEPTED as recommended)

Single **Teacher Workspace** at `/t/:tenantId/teacher` with **Class** (Darasa) and **Subject** (Somo) modes as persistent tabs inside one shell.

- **Default mode is computed, never asked.** Full decision table:
  1. Attendance session pending today → **Class**.
  2. Marks window open for an assigned exam-subject (and no pending attendance) → **Subject**.
  3. Both pending → **last-used**; if no last-used exists yet → Class.
  4. **Neither pending** (weekends, holidays, no capture window) → last-used; if none → Class if the user has any class-teacher relationship, else Subject.
  5. Teacher with only one relationship type never sees the other tab (no fallthrough possible).
- **Last mode remembered** per user × tenant (server-side preference, not device-only — teachers share devices).
- **Never two apps/portals.** Class Teacher and Subject Teacher are *relationships* (Access Control Bible: "class teacher to class", "teacher to assigned subject"), not separate identities. One human, one workspace, capability-scoped features.

Rationale: assignment data already exists (MVP: teacher assignments, attendance, marks). Mode = a filter over relationships, so the AuthZ model needs zero new concepts. Asking "class or subject?" every login violates "keep daily tasks fast" (09_FRONTEND_GUIDELINES).

### D2 — Sign-in routing ni capability-based (ACCEPTED as recommended)

Resolution pipeline after authentication:

1. AuthN (Auth0 OIDC).
2. MFA per role policy (platform roles: hard, always — Assumption 6).
3. **Resolve platform capability first.** Platform Super Admin / Platform Support capability → route to `/platform` (platform roles need no tenant membership; tenant portals are reachable by them *only* via an audited support session).
4. Resolve tenant memberships. **>1 tenant → tenant picker.**
5. Resolve portal capabilities within the chosen tenant.
6. Exactly 1 portal capability → auto-enter.
7. **>1 capability:** if a persisted last-portal preference exists for this user × tenant → enter it. If none (first login) → show portal chooser ordered by priority, defaulting to the highest-priority capability.
8. Persist last-portal per user × tenant on every explicit switch.

- **Precedence rule (explicit):** persisted preference **beats** priority order; priority order is only the first-login default and the chooser sort key.
- **Capability priority:** Platform > Head (includes Head-by-delegation for Deputies — Deputy is not a separate portal, see P5) > School Admin > Teacher > Student > Parent. School Owner has no dedicated portal: an Owner's landing is determined by the capabilities they actually hold (typically School Admin).
- Username string matching is forbidden; capabilities come from RBAC + relationships + ABAC (32_ACCESS_CONTROL_BIBLE layered model).
- **Audited switches:** entering **any privileged portal context** — `/platform`, Head portal, School Admin portal (contains user/role management and Fees office), and any support-session entry — emits an audit event. Teacher/Student/Parent portal entry is not audited as a switch (normal daily use).
- **Proposed retirement (routed via DSF-KIT-002, not enacted by this draft):** IMP-050's owner/admin "preview all workspaces" switcher and DSF-KIT-001 §4's post-login routing rule are replaced by this capability pipeline. Until DSF-KIT-002 is accepted, IMP-050 remains the frozen behavior.

### D3 — "Most professional UI" kama design brief inayotekelezeka

Not a vibe — an enforceable brief layered on DSF-KIT-001:

1. **Operations aesthetic** stays binding: calm, dense-where-needed, zero marketing-hero inside portals (07_DESIGN_SYSTEM + DSF-KIT-001 §1).
2. **One token family, portal-differentiated chrome.** Shared core tokens (bg/ink/spacing/type from DSF-KIT-001 §2). Each portal gets: (a) a nav pattern suited to its user (left rail = admin/platform/head; bottom/top compact = teacher/student/parent), (b) a portal identity mark (name + subtle accent variation within the approved palette), (c) its own density contract. Divergence beyond this needs DSF-KIT amend.
3. **Distinct EduCore brand:** keep and deepen the current teal-green/ink operational identity (`--color-accent #0f6b5c`, rail `#12202b`). Explicitly banned: AI-purple/cream/terracotta/broadsheet defaults (already codified in DSF-KIT-001 §1).
4. **Mobile-first** for Teacher/Student/Parent; dense-readable for Admin/Platform/Head. Low-end Android + 3G budgets (09 guidelines).
5. **Mandatory operational states** on every primary surface: loading / empty / error / forbidden / offline / success (DSF-KIT-001 §6 — extended to all new portals).
6. **EN/SW without layout break**; WCAG 2.1 AA baseline (DSF-KIT-001 §7).

Deliverable of D3 = **DSF-KIT-002 amendment** (portal chrome model + brand deepening + IMP-050 retirement + new post-login routing rule) before any redesign coding.

---

## 3. PORTAL SPECS (portal map + IA)

### P1 — Platform Super Admin Portal (`/platform`) — *Msimamizi wa Mfumo*

- **Users:** Super Admin (Owner); Platform Support (restricted, session-scoped — **later phase, per Q8; not provisioned in Phase 1**).
- **MFA:** per Assumption 6 — hard at session start, always; step-up for destructive actions.
- **Jobs-to-be-done (≤7):**
  1. Register a new school (tenant) and hand off to school onboarding.
  2. View registered schools with health/status (active, suspended, trial, delinquent; workflow SLO glance).
  3. Suspend / reinstate / retire a tenant (with reason + audit).
  4. Assign subscription plan + entitlements/feature flags per tenant *(proposed MVP-scope amendment — Assumption 4)*.
  5. See metered usage per tenant (SMS, AI, storage, payment ops) *(proposed MVP-scope amendment)*.
  6. Open a time-bound, reasoned, audited support-access session into a tenant.
  7. Review platform audit trail for privileged actions.
- **Out of scope:** student-fee MoMo operations; editing tenant-internal data directly (support session is the only path, and it is read-scoped unless amended); marketing/CRM.
- **Nav (rail):**

```
EduCore Platform
├── Shule (Schools)        ← list, health, register, suspend
├── Bili & Mipango         ← plans, entitlements, metering
├── Support                ← sessions (time-bound, audited)
├── Ukaguzi (Audit)
└── Mipangilio (Settings)  ← flags, platform config
```

### P2 — School Admin Portal (`/t/:id/admin`) — *Ofisi*

- **Users:** School Owner, Registrar, Secretary, Academic Master, Accountant/Bursar (finance-filtered), Headmaster when doing admin work.
- **JTBD (≤7):** manage users & roles; academic structure (years/terms/classes/streams/subjects/assignments); students & guardians registry; fees office (structures, invoices, receipts, reconciliation); notifications/SMS; reports & report cards; school settings (language, branding, academic config).
- **Out of scope:** platform billing; cross-tenant anything; teacher capture flows (attendance/marks entry live in Teacher Workspace).
- **Nav:** keep the frozen grouped IA (DSF-002 / IMP-029): `Registry · Access · Academic · Fees · Notifications · Settings` + dashboard home. Redesign here is **visual/density polish, not IA change**.

### P3 — Teacher Workspace (`/t/:id/teacher`) — *Mwalimu* (see §5 for mode model)

- **Users:** Class Teachers, Subject Teachers (same humans, different relationships).
- **JTBD (≤7):** see today's duties; capture attendance (offline-capable); enter marks; submit marks for approval; view own classes/subjects status; see sync/offline queue; switch language.
- **Out of scope:** approvals (Head), fees, user management, report card issuance.
- **Nav (mobile-first, mode tabs under a shared shell):**

```
Mwalimu — [Darasa] [Somo]        ← mode tabs (D1)
├── Leo (Today)                   ← duties for today, per mode
├── Mahudhurio / Alama            ← capture surface per mode
├── Hali ya usawazishaji          ← offline/sync strip (always visible)
└── Wasifu (Profile · lugha · toka)
```

### P4 — Head Teacher Portal (`/t/:id/head`) — *Mwalimu Mkuu*

- **Users:** Headmaster; Deputy Headmaster (delegation-scoped — see Q1).
- **JTBD (≤7):**
  1. School health dashboard: attendance rate, fee collection, payment failures, academic performance, at-risk students, notification delivery (the 07_DESIGN_SYSTEM Headmaster list). **"At-risk students" is rule-based in v1** (attendance/fee/marks thresholds defined at DSF-008 time). Any model-based risk scoring is out of scope until it passes the SRS high-risk-AI path (evaluation, human review, privacy controls) — and would then still need its own gate.
  2. Approve / reject submitted marks. **Explicit deny (proposed extension of 32 §Explicit Deny):** an approver cannot approve marks they themselves submitted as a teacher — reachable because the matrix allows Deputy/Owner to also teach.
  3. Review exceptions as **defined aggregates**: exception type, amount, status, reference ID, age — never raw ledger postings or journal drill-down. Deeper finance drill-down requires a real finance capability (Q7).
  4. Delegate authority — full Bible record: **delegator, delegatee, scope, permissions, expiry, reason, audit trail** (32 §Delegation).
  5. Drill from KPI → exception list (bounded per JTBD 3).
  6. Review privileged-access audit for own school.
  7. View/export school summary reports (read-only aggregates; same finance boundary as JTBD 3).
- **Out of scope:** data entry, finance posting, platform functions.
- **Nav (rail, decision-first):**

```
Mwalimu Mkuu
├── Dashibodi (Today/health KPIs)
├── Vibali (Approvals: marks, delegations)
├── Hoja (Exceptions: sync, recon, delivery)
├── Ripoti (Reports — read-only aggregates)
└── Ukaguzi (Audit — own school)
```

### P5 — Deputy / Assistant Head (`/t/:id/head`, delegation-scoped) — **PROPOSED CONSOLIDATION**

Recommendation: Deputy is **not a sixth portal**. Deputy enters the Head portal shell with visibility/actions filtered by an explicit delegation record carrying all seven Bible fields (**delegator, delegatee, scope, permissions, expiry, reason, audit trail** — 32_ACCESS_CONTROL_BIBLE §Delegation). Chrome labels the delegated context ("Unatenda kwa niaba ya Mwalimu Mkuu — mamlaka: …, hadi: …").
Rationale: constraint "progressive disclosure over portal sprawl"; a separate portal would duplicate every Head screen minus a few. In the D2 priority order, a Deputy resolves to the **Head** portal (delegation-scoped) — "Deputy" is not a routing target. Owner may reject (→ Q1).

### P6 — Student Portal (`/t/:id/student`) — *Mwanafunzi* — **PROPOSED SRS AMENDMENT**

- **Users:** Students only. Read-only by design; zero admin powers.
- **JTBD (≤6):** view own attendance; view published results/report cards; view fee balance + receipts (read); receive school messages; view timetable **only if** the timetable module is added to SRS (it does not exist today → Q3); manage own language preference.
- **Out of scope:** payments initiation, editing anything, sibling/other-student data (explicit deny), messaging teachers directly (v1).
- **Identity is the hard problem** (children, shared/no phones, consent) → Q2. No self-signup; school-issued credentials only.
- **Nav (bottom tabs, mobile-first):** `Leo · Mahudhurio · Matokeo · Ada · Ujumbe`.

### P7 — Parent Portal (`/t/:id/parent`) — *Mzazi* (existing, refine per DSF-006)

- **Users:** Parents/guardians, relationship-scoped to own children only (explicit deny beyond that).
- **JTBD (≤7):** select child; see fee balance; pay fees (MoMo); view attendance; view results; view receipts; read school messages.
- **Out of scope this phase:** any scope growth (new modules); two-way messaging; multi-school aggregation.
- **Refinements (UX only):** child switcher prominence; payment status honesty states (pending/confirmed/failed per DSF-KIT-001 status language); SW-first defaults.
- **Nav (simple header + tabs):**

```
Mzazi — [Mtoto ▼]                 ← child switcher, always visible
├── Ada (balance · lipa · risiti)
├── Mahudhurio
├── Matokeo
└── Ujumbe
```

---

## 4. AUTH & ROUTING MATRIX

Landing = **first-login default**; after that the persisted last-portal preference wins (D2 precedence rule).

| Role (SRS) | First-login landing | Also available (capability-based) | MFA | Notes |
| --- | --- | --- | --- | --- |
| Super Admin | Platform | Tenant portals **only** via audited support session | Hard at session, always + step-up destructive | Every write audited |
| Platform Support *(later phase — Q8)* | Platform (restricted) | Tenant read via approved session | Hard at session, always | Time-bound sessions; not provisioned Phase 1 |
| School Owner | School Admin (or highest capability actually held) | Head (if granted), Teacher/Parent (if real relationships) | Hard for privileged | No blanket "preview" — capabilities only |
| Headmaster | Head | School Admin (switch audited) | Hard for approvals/admin | |
| Deputy Headmaster | Head (delegation-scoped) | Teacher (if teaching) | Hard for delegated privileged acts | Delegation banner always visible; cannot approve own submitted marks |
| Academic Master / Registrar / Secretary | School Admin (nav-filtered) | Teacher (if teaching) | Per policy | |
| Accountant / Bursar | School Admin (Fees-focused) | — | Hard (finance) | Least privilege on finance |
| Class/Subject Teacher | Teacher Workspace | Parent (if is a parent at same school) | Per policy | Mode auto-selected (D1) |
| Student | Student | — | No (strong credential policy) | Read-only |
| Parent | Parent | — | No | Relationship-scoped to own children |

Entry behavior (all roles): authn → MFA policy → platform capability check → tenant picker if >1 membership → persisted preference or first-login default (D2 steps 6–8) → portal switcher visible when >1 capability → switches into privileged portals (`/platform`, Head, School Admin, support sessions) audited.

---

## 5. TEACHER MODE MODEL

| | **Class mode (Darasa)** | **Subject mode (Somo)** |
| --- | --- | --- |
| Anchor relationship | class teacher → class | teacher → assigned exam-subject |
| Home | today's attendance session(s) | open marks windows |
| Core actions | capture attendance (offline queue); review class register; class attendance history | enter marks (only while window open **and not yet approved**); save draft; submit for approval; view approval status |
| Read views | class roster, per-student attendance trend | subject performance snapshot after approval |
| Locked out | marks entry for unassigned subjects; **editing approved/locked marks (explicit deny, 32 §Explicit Deny + SRS "approved marks must not be silently overwritten")** | attendance for classes not class-teacher of; **editing approved/locked marks (same deny; UI shows locked state, not an editable field)** |

**Shared shell (both modes):** Leo (today) header, mode tabs, offline/sync status strip, profile + language, logout. Mode default per D1 decision table; a teacher with only one relationship type never sees the other tab.

---

## 6. PHASED MVP PLAN

| Phase | Ships | Why this order | Gate before coding |
| --- | --- | --- | --- |
| **0** | This spec approved; DSF-KIT-002 (portal chrome + brand + IMP-050 retirement + routing rule); SRS amendment drafts (**student portal, timetable, platform billing/entitlements/metering**); ACF/DBF drafts for Platform Operations | Everything downstream depends on frozen contracts | Owner GO on this doc |
| **1a** | **Platform Super Admin MVP**: tenant register/list/health/suspend + audit view; plans/entitlements/metering only if their SRS amendment is accepted | Owner's own tooling; unblocks real multi-school ops; API module exists as verified skeleton but has no contracts | SRS amend (billing) + ACF-PLAT + DBF-PLAT + DSF-007 |
| **1b** | **School Admin visual redesign** on frozen IA (density, polish, dashboard) | Rejected-as-unprofessional today; IA already frozen so risk is low | DSF-002 amend |
| **2** | **Teacher Workspace modes** (D1) over existing attendance/marks | Highest daily-use surface; no new domain features, only re-shelling | DSF-001/003 amend; verify marks-window/lock states in ACF |
| **3** | **Head portal** (dashboards + marks approvals + exceptions) and Deputy-via-delegation | Needs KPI aggregation endpoints; marks submit/approve flow assumed present — **re-verify at gate** (Assumption 8) | DSF-008 + ACF for KPI/BFF endpoints + delegation ACF/DBF (all 7 Bible fields) + self-approval deny test |
| **4** | **Student portal** read-only | Blocked on SRS amendment + student identity decision (Q2) | SRS amend + DSF-009 + identity ACF |
| **5** | **Parent refine** + payment status honesty polish | Lowest risk; already functional | DSF-006 amend |

Vertical slices within each phase; no phase starts coding before its listed freezes.

---

## 7. GAP VS CURRENT LAB UI

**Keep (works, frozen):** token system + dark theme; EN/SW catalog + locale preference; AdminShell grouped IA; error mapper + forbidden/empty/loading states; tables/StatusChip/ConfirmDialog primitives; report-card print CSS; MFA panel; session handling.

**Redesign:** visual layer of Admin (density, dashboard, "professional" polish per D3); TeacherShell → mode-tabbed workspace; Admin-home KPI tiles migrate/duplicate into Head portal as decision dashboards; login → add tenant picker + portal resolution flow.

**Retire (proposed — enacted only via DSF-KIT-002 acceptance, per D2):** IMP-050 owner/admin "preview all workspaces" switcher (replaced by capability-based portal availability + audited switching); disabled "Student" hint chip (replaced by real Student portal in Phase 4); DSF-KIT-001 §4 post-login routing rule (replaced by D2 pipeline); any username-pattern routing remnants.

---

## 8. FREEZE / SPEC GATE CHECKLIST (before any coding)

- [ ] **Owner GO** on this spec (portal map, D1–D3, phases)
- [ ] **DSF-KIT-002** — portal chrome model, brand deepening, portal identity marks, nav patterns per portal, **IMP-050 retirement, D2 post-login routing rule replacing DSF-KIT-001 §4 rule 2**
- [ ] **DSF-007** — Platform Super Admin screen inventory
- [ ] **DSF-008** — Head Teacher portal screen inventory (incl. at-risk rule definitions, exception aggregate fields)
- [ ] **DSF-009** — Student portal screen inventory (Phase 4, after SRS amend)
- [ ] **DSF-001/002/003/006 amendments** — teacher modes, admin redesign scope, parent refine
- [ ] **ACF-PLAT-xxx** — Platform Operations contracts (tenant lifecycle, health, support sessions, audit; plans/entitlements/metering if amended in)
- [ ] **DBF-PLAT-xxx** — platform billing/entitlement/support-session tables
- [ ] **ACF** — portal-preference persistence, portal-switch audit events, Head KPI/BFF endpoints, delegation records (all 7 Bible fields), marks lock/window states
- [ ] **SRS amendments** — Student portal scope; timetable module (or explicit exclusion); **platform subscription plans/entitlements/metering into MVP scope**; self-approval marks deny into 32 §Explicit Deny
- [ ] **Access-control golden tests plan** updated for: Head approvals (incl. self-approval deny), delegation, student read-only, platform roles, audited portal switches

---

## 9. OWNER QUESTIONS — **RESOLVED 2026-08-15: Owner accepted ALL recommended defaults (GO in session)**

Locked decisions: Q1 Deputy = Head shell + delegation · Q2 student = school-issued credential, no self-signup · Q3 Student v1 bila timetable · Q4 manual plans + entitlement flags (kwa SRS amendment) · Q5 deepen teal/ink brand · Q6 preference + switcher (chooser first login tu) · Q7 Head = aggregates + defined exceptions tu · Q8 Platform Support si Phase 1 · Q9 lugha default per portal kwa tenant setting (T/S/P=SW, Admin/Platform=EN) · Q10 web-responsive kwanza, RN haiathiriwi.

1. **Deputy:** portal tofauti au Head portal yenye delegation scope? — *Default: shared Head shell + delegation banner (P5).*
2. **Student identity:** watoto wana-login vipi? — *Default: admission number + school-issued credential, hakuna self-signup; guardian consent kwenye enrollment; final design Phase 4.*
3. **Timetable:** haipo kwenye SRS — tuiongeze kwa amendment au Student v1 iende bila timetable? — *Default: bila timetable v1 (attendance/results/fees/messages tu).*
4. **Platform billing depth Phase 1:** full subscription invoicing au manual plan assignment + entitlement flags? — *Default: manual plans + flags (bado zinahitaji SRS amendment — Assumption 4); invoicing baadaye.*
5. **Brand:** tuendeleze teal/ink identity ya sasa au brand mpya kabisa? — *Default: deepen ya sasa; rebrand ni track tofauti.*
6. **Portal entry (>1 capability):** chooser kila login au preference + switcher? — *Default: persisted preference (first login: chooser ordered by priority) + visible switcher — D2 steps 6–8.*
7. **Head na finance:** aggregates + exceptions tu, au drill-down hadi postings? — *Default: aggregates + defined exception fields (P4 JTBD 3); drill-down inahitaji finance capability halisi.*
8. **Platform Support role:** iwepo Phase 1? — *Default: hapana — Super Admin pekee Phase 1; support sessions phase ya pili ya platform (matrix row ni ya baadaye).*
9. **Default language per portal:** — *Default: tenant setting; Teacher/Student/Parent default Kiswahili, Admin/Platform default English (inabadilishwa na user).*
10. **Mobile RN app timing:** — *Default: web-responsive kwanza; RN haiathiriwi na redesign hii.*

---

## Amendments

| Ver | Date | Notes |
| --- | --- | --- |
| 0.1 | 2026-08-14 | Initial draft for Owner gate |
| 0.2 | 2026-08-14 | Doubt cycle 1: fixed Super Admin routing (platform capability resolved before tenancy), preference-vs-priority precedence, Deputy removed as routing target, platform billing marked as SRS amendment, delegation record completed to 7 Bible fields, approved-marks lock + self-approval denies added, D1 default-mode fallbacks, unified platform MFA statement, P3/P7 IA + JTBD added, Head "Ripoti" backed by JTBD 7, audited-switch list broadened, IMP-050 retirement routed through DSF-KIT-002 |
| 1.0 | 2026-08-15 | **Accepted.** Owner GO in session; all 10 questions resolved to recommended defaults. Cross-model second opinion not requested — proceeding with single-model doubt findings. Gate form per SOLO-GOV-003. |
