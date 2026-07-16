# Identity & Tenant — Governance Completion Plan

| Field               | Value                                                                                                                                                                                                                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Document ID**     | `GCP-IT-001`                                                                                                                                                                                                                                                                                                             |
| **Title**           | Complete Governance Closure for Identity & Tenant (ADR-012 + DBF-001 + ACF-001)                                                                                                                                                                                                                                          |
| **Status**          | **Closed — solo-operator completion (SOLO-GOV-001)**                                                                                                                                                                                                                                     |
| **Created**         | 2026-07-15                                                                                                                                                                                                                                                                                                               |
| **Last updated**    | 2026-07-16                                                                                                                                                                                                                                                                                                               |
| **Owner**           | Principal Architect / Governance Lead                                                                                                                                                                                                                                                                                    |
| **Hard constraint** | ADR-012 **hard expiry: 2026-09-15**                                                                                                                                                                                                                                                                                      |
| **Related**         | [ADR-012](../decisions/ADR-012-exception-identity-tenant-implementation.md) · [GAP-IT-001](./IDENTITY_TENANT_GOVERNANCE_ACTION_PLAN.md) · [Countersignature Packet](./ADR-012_COUNTERSIGNATURE_PACKET.md) · [Freeze Acceptance](../gates/FREEZE_ACCEPTANCE_IDENTITY_TENANT.md) · [Outbox SEND_LOG](./outbox/SEND_LOG.md) |

---

## 0. Five immediate actions (start today — 2026-07-16)

> **Update 2026-07-16 (later same day):** External send is **cancelled**. Named countersigners
> are theoretical. Project Owner authorized solo-operator consolidation —
> see [SOLO-GOV-001](./SOLO_OPERATOR_GOVERNANCE_NOTE.md). Countersignatures, DBF/ACF Freeze v1.0,
> and FREEZE-ACC-001 Accepted status are **complete in-repo**. Rows below are historical process design.

| # | Action | Owner | Done when |
| - | ------ | ----- | --------- |
| 1 | ~~Send three outbox emails~~ → acting seats signed ADR-012 | PA (acting) | **Done** — SOLO-GOV-001 |
| 2 | ~~Confirm real mailboxes + video~~ | — | **N/A** — cancelled |
| 3 | ~~Calendar holds for chase~~ | — | **N/A** — early closure |
| 4 | Name ACG + PO | PA | **Done** — ACG = Backend dual-hat; PO directed consolidation |
| 5 | Clarify ADR ≠ Freeze | PA | **Done** — then Freeze v1.0 completed same session |

### 0.1 Closure summary (2026-07-16)

| DoD | Outcome | Status |
| --- | ------- | ------ |
| D1 | ADR-012 countersignatures | **Done** (acting) |
| D2 | Formal review ≤ 2026-08-15 | **Done** as solo-operator closure (no multi-person meeting) |
| D3 | DBF-001 signed | **Done** (acting) |
| D4 | ACF-001 signed | **Done** (acting) |
| D5 | FREEZE-ACC-001 updated | **Done** — Accepted v1.0 (solo-operator) |
| D6 | Status language honest | **Done** — always qualify solo-operator |

**Residual:** Product CRUD / role-admin HTTP remain gated. Do not claim independent peer review.

---

## 1. Purpose

This plan is the **single operational playbook** to close Identity & Tenant governance before ADR-012 expires. It unifies:

1. **ADR-012 multi-role countersignatures** (Database Architect, Security Lead, Backend Lead).
2. **Human Freeze v1.0 signatures** on **DBF-001** and **ACF-001**.
3. **Time-bound review** of the exception and clean supersession (or renewal / wind-down).
4. **Communication templates**, **checklists with owners**, **risks**, and **process efficiency** practices.

It is **process and accountability documentation**. Originally it did **not** authorize claiming Freeze v1.0 without signatures. On **2026-07-16**, Freeze v1.0 was recorded under [SOLO-GOV-001](./SOLO_OPERATOR_GOVERNANCE_NOTE.md) (acting seats). It still does **not** replace Architecture Freeze v1.0 in the immutable kit, and does **not** auto-open remaining product HTTP.

### Success definition (Definition of Done)

Governance for this slice is **complete** when **all** of the following are true:

| #   | Outcome                                              | Evidence                                                             |
| --- | ---------------------------------------------------- | -------------------------------------------------------------------- |
| D1  | All three ADR-012 countersignatures recorded         | Approval table in ADR-012 filled (Name, Date, phrase)                |
| D2  | ADR-012 formal review held on or before 2026-08-15   | Minutes + decision (continue / renew / expire path)                  |
| D3  | DBF-001 approval block has required human signatures | Signed Freeze v1.0 (or explicit written deferral with owner + date)  |
| D4  | ACF-001 approval block has required human signatures | Signed Freeze v1.0 (or same-quality deferral)                        |
| D5  | Freeze Acceptance record updated                     | `FREEZE_ACCEPTANCE_IDENTITY_TENANT.md` status reflects reality       |
| D6  | Team messaging is consistent                         | README / status docs say “Freeze v1.0 accepted” **only** after D3–D5 |

**Preferred path before hard expiry:** D1 → D2 → D3 → D4 → D5 → D6, so ADR-012 is **historically superseded by freezes**, not silently renewed forever.

---

## 2. Current state (facts as of plan date)

### 2.1 Governance

| Artifact                | Status                                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| ADR-012                 | **Accepted** 2026-07-15 (Principal Architect). Countersignatures **pending**.                                     |
| DBF-001                 | Design complete; **human Freeze v1.0 signatures incomplete**.                                                     |
| ACF-001 + OpenAPI       | Design complete / hardened; **human Freeze v1.0 signatures incomplete**.                                          |
| FREEZE-ACC-001          | **Conditional acceptance** only — not full Freeze v1.0.                                                           |
| Countersignature outbox | Emails + calendar **prepared**, **not sent** (human must send). See [`outbox/SEND_LOG.md`](./outbox/SEND_LOG.md). |

### 2.2 Engineering progress under Conditional Freeze / ADR-012

Implementation has advanced (IMP-001 through **P4 RBAC foundation** + **P4b hardening**). Reviewers must understand:

| Area                | State                                                                                              | Still closed / residual                                           |
| ------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Schema + RLS        | Tenants, users, memberships, sessions, RBAC tables; FORCE RLS; live isolation evidence             | Residual T1–T8 product matrix; migration rework if freezes change |
| AuthN (P3)          | Login / refresh / logout / me / select-tenant under `/api/v1/auth/*`                               | MFA; production IdP; session admin list/revoke                    |
| AuthZ (P4 / P4b)    | System roles seed, `PolicyEvaluator`, `RequirePermission`, `/auth/me` permissions; **session↔header tenant bind**; ops grant reconcile | Role-admin HTTP; first privileged **business** route; domain UIs |
| Product domain HTTP | Tenant CRUD, membership invite, Student/Finance/etc.                                               | **NO GO** until freezes (or new ADR)                              |

**Honesty rule for all communications:** Do not claim “only scaffolding with zero HTTP.” Platform AuthN/AuthZ routes exist; **tenant/user admin and other domain product APIs remain closed.** Manual verification plan: `tasks/manual-test-p4b-rbac.md`.

### 2.3 Named countersigners

| Role                                  | Person                  | ADR-012           | DBF-001               | ACF-001                             |
| ------------------------------------- | ----------------------- | ----------------- | --------------------- | ----------------------------------- |
| Principal Architect / Exception Owner | EduCore PA (Governance) | Signed 2026-07-15 | Expected              | Expected                            |
| Database Architect                    | **PM Master**           | Pending           | Expected (primary)    | Optional / awareness                |
| Security Lead                         | **Masoud Salum**        | Pending           | Expected              | Expected                            |
| Backend Lead                          | **Rashid Mohammed**     | Pending           | Expected              | Expected (or dual-hat API Guardian) |
| API Contract Guardian                 | _Name if not BE_        | —                 | —                     | Expected if separate                |
| Product Owner / Project Lead          | _To be named_           | Cc / calendar     | Unblock calendar time | Unblock calendar time               |

---

## 3. Guiding principles

1. **Exception ≠ Freeze.** Countersigning ADR-012 accepts residual risk of provisional work; it does **not** accept DBF/ACF v1.0.
2. **Human authority only.** AI chat, MASTER PROMPTs, and agent sessions are **not** freeze acceptance.
3. **Busy-person design.** Default to ≤40 minutes first read; parallel tracks; calendar-first; one decision reply (APPROVE / CHANGES / DELEGATE).
4. **Fail closed on product surface.** Prefer delayed freeze signatures over silent expansion of tenant CRUD or domain modules.
5. **Document every send and reply** in [`outbox/SEND_LOG.md`](./outbox/SEND_LOG.md).
6. **Prefer supersession over renewal.** Renew ADR-012 only if freezes cannot complete by 2026-09-15 **and** residual risk is re-accepted in writing.

---

## 4. Priority order (what first)

Execute in this order. Later work may **prepare in parallel**, but do not reverse the decision sequence.

```text
P0  Collect real emails + send ADR-012 packet + calendar
      ↓
P1  Collect three ADR-012 countersignatures
      ↓
P2  Hold ADR-012 review meeting (≤ 2026-08-15) + publish minutes
      ↓
P3  Freeze fidelity pass (DBF vs migrations; ACF vs OpenAPI/impl)
      ↓
P4  Human signatures on DBF-001 and ACF-001 (target ≤ 2026-09-01)
      ↓
P5  Update FREEZE-ACC-001 + public status language (≤ 2026-09-08)
      ↓
P6  ADR-012 closed by supersession (preferred) before 2026-09-15
```

| Priority  | Workstream                      | Why first                                        |
| --------- | ------------------------------- | ------------------------------------------------ |
| **P0**    | Transmission                    | Prepared materials unused until humans send them |
| **P1**    | ADR countersignatures           | Shared ownership before formal review            |
| **P2**    | Review meeting                  | Binding ADR condition                            |
| **P3–P4** | Freeze fidelity + signatures    | Clean supersession of exception                  |
| **P5–P6** | Record update + close exception | Prevent docs drift and permanent exceptions      |

---

## 5. Master timeline (realistic, before 2026-09-15)

Assumes start of active execution **immediately** (packet already prepared). Timezone for meetings: **EAT (UTC+3)** unless participants agree otherwise.

### 5.1 Critical path milestones

| ID  | Milestone                                                    | Target date                                               | Binding / soft     | Owner              |
| --- | ------------------------------------------------------------ | --------------------------------------------------------- | ------------------ | ------------------ |
| M0  | Real emails collected; placeholders removed from `.ics`      | **2026-07-16** (today)                                        | Soft (urgent)      | PA + PO            |
| M1  | All three countersignature emails + calendar invite **sent** | **2026-07-16** (latest **2026-07-18**)                        | Soft               | PA                 |
| M2  | Soft reminder if no reply                                    | **2026-07-30**                                            | Soft               | PA                 |
| M3  | Final reminder                                               | **2026-08-05**                                            | Soft               | PA                 |
| M4  | **All ADR-012 countersignatures complete**                   | **2026-08-08**                                            | **Hard (process)** | DBA, SEC, BE       |
| M5  | **ADR-012 Review Meeting held**                              | **2026-08-13** 10:00–11:15 EAT (alt **2026-08-12** 14:00) | Soft preferred     | PA (convene)       |
| M6  | Binding ADR review-by                                        | **2026-08-15**                                            | **Hard (ADR)**     | PA                 |
| M7  | Minutes + follow-ups published                               | **2026-08-16**                                            | Soft               | PA                 |
| M8  | Freeze fidelity packs ready (DBF + ACF)                      | **2026-08-22**                                            | Soft               | DBA + BE/ACG + SEC |
| M9  | Freeze review sessions (async or 60–90 min)                  | **2026-08-25 – 2026-08-29**                               | Soft               | PA                 |
| M10 | **DBF-001 + ACF-001 human signatures complete**              | **2026-09-01**                                            | **Hard (plan)**    | All signers        |
| M11 | FREEZE-ACC-001 + status docs updated                         | **2026-09-08**                                            | Soft               | PA                 |
| M12 | **ADR-012 hard expiry**                                      | **2026-09-15**                                            | **Hard (ADR)**     | PA                 |

### 5.2 Why these dates are realistic

| Choice                                                | Rationale                                                                    |
| ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| ~3 weeks for countersignatures (send → 08 Aug)        | Busy leaders need ≥2 reminder cycles without compressing first read          |
| Review **13 Aug**, binding **15 Aug**                 | Two-day buffer for reschedule / minutes                                      |
| Freeze signatures **01 Sep**, not same week as review | Avoid asking for exception **and** full freeze in one sitting                |
| Doc update **08 Sep**, expiry **15 Sep**              | One week buffer for straggler signatures or narrow amendment                 |
| No “same-day GO to open all product routes”           | Freezes authorize design; product expansion still needs gated implementation |

### 5.3 Calendar visualization

```text
July 2026                 August 2026                        September 2026
|15  16····18····30|····05··08····12/13··15····22····25-29|····01····08····15|
 ADR  SEND   soft  final  CS   REVIEW  bind  packs freeze   FREEZE  docs  EXPIRY
 acc  emails remind remind due  meeting  by   ready sessions SIGS    upd   hard
```

---

## 6. Workstreams and tasks

### Workstream A — Transmit and track ADR-012 countersignatures

**Goal:** Shared, auditable ownership of the exception before the review meeting.

| Task | Description                                                               | Owner              | Due               | Acceptance                                                  |
| ---- | ------------------------------------------------------------------------- | ------------------ | ----------------- | ----------------------------------------------------------- |
| A1   | Collect real email addresses for PM Master, Masoud Salum, Rashid Mohammed | PA / PO            | 2026-07-16        | Addresses recorded in SEND_LOG (not committed if sensitive) |
| A2   | Update `.ics` with real attendees + video link                            | PA                 | 2026-07-16        | Invite imports cleanly                                      |
| A3   | Send three personalized emails + calendar invite                          | PA                 | 2026-07-16 (≤18)  | SEND_LOG: **SENT** + message IDs / timestamps               |
| A4   | Soft / final reminders                                                    | PA                 | 07-30 / 08-05     | Logged                                                      |
| A5   | Record APPROVE / CHANGES / DELEGATE replies                               | PA                 | Rolling → 08-08   | Each row updated in ADR-012 Approval table                  |
| A6   | Resolve CHANGES REQUESTED (docs or scope note)                            | PA + relevant lead | ≤ 48h after reply | Written disposition                                         |

**Countersignature phrase (required):**

```text
Countersigned — exception only; Freeze v1.0 still pending
```

**Dependencies:** None (materials already in `outbox/`).  
**Checkpoint A:** All three countersignatures present **or** documented DELEGATE + alternate signature by **2026-08-08**.

---

### Workstream B — ADR-012 formal review

**Goal:** Satisfy ADR review condition; decide path to freezes or renewal.

| Task | Description                                              | Owner | Due          | Acceptance                                  |
| ---- | -------------------------------------------------------- | ----- | ------------ | ------------------------------------------- |
| B1   | Confirm attendance (quorum: PA + ≥2 of DBA/SEC/BE)       | PA    | 2026-08-10   | Attendance list                             |
| B2   | Hold meeting (agenda §6.1)                               | PA    | ≤ 2026-08-15 | Held                                        |
| B3   | Publish minutes (decisions, owners, dates)               | PA    | 2026-08-16   | Linked from ADR-012 or `governance/outbox/` |
| B4   | If freezes blocked: open amendment / renewal draft early | PA    | 2026-08-20   | Draft ADR amendment or risk register entry  |

#### 6.1 Review meeting agenda (75 minutes)

| Time  | Topic                                                      | Outcome                      |
| ----- | ---------------------------------------------------------- | ---------------------------- |
| 0–10  | Exception purpose vs Freeze v1.0                           | Shared mental model          |
| 10–25 | Engineering reality (AuthN/AuthZ vs closed CRUD)           | Honest inventory             |
| 25–40 | Residual risks (migration rework, RLS, HTTP surface)       | Accept / mitigate / escalate |
| 40–55 | Path to DBF/ACF signatures (fidelity gaps)                 | Owners + dates               |
| 55–70 | Decision: continue exception → freezes **or** renew/narrow | Recorded vote/consensus      |
| 70–75 | Actions + owners                                           | Minutes draft                |

**Checkpoint B:** Minutes published; binding review-by not violated.

---

### Workstream C — Freeze fidelity preparation (before asking for Freeze v1.0)

**Goal:** Make “yes” easy for busy signers. Do **not** request Freeze signatures until packs exist.

| Task | Description                                                                          | Owner       | Due           | Acceptance                                                       |
| ---- | ------------------------------------------------------------------------------------ | ----------- | ------------- | ---------------------------------------------------------------- |
| C1   | **DBF fidelity matrix:** migrations ↔ DBF-001 tables/policies; list drifts           | DBA + PA    | 2026-08-22    | 1–2 page matrix in `docs/engineering/governance/` or task record |
| C2   | **ACF fidelity matrix:** OpenAPI ↔ implemented `/api/v1/auth/*` + closed routes      | BE/ACG + PA | 2026-08-22    | Same form                                                        |
| C3   | Security residual note (live tests, grants, GUC model, what is not production-ready) | SEC + PA    | 2026-08-22    | Short bullet list + evidence links                               |
| C4   | Update DBF-001 / ACF-001 text **if** material drift (before signatures)              | DBA / ACG   | 2026-08-27    | Diff reviewed; no silent schema claim                            |
| C5   | Schedule freeze signature window (async preferred)                                   | PA          | 2026-08-25–29 | Calendar or async deadline **2026-09-01**                        |

**Checkpoint C:** Fidelity packs exist; no known blocking mismatch left undocumented.

---

### Workstream D — Human signatures on DBF-001 and ACF-001

**Goal:** Formal Freeze v1.0 for the Identity & Tenant slice designs.

| Task | Description                                                  | Owner                                     | Due            | Acceptance                |
| ---- | ------------------------------------------------------------ | ----------------------------------------- | -------------- | ------------------------- |
| D1   | Send Freeze signature request (after C packs)                | PA                                        | 2026-08-25     | Emails logged             |
| D2   | Collect DBF-001 signatures                                   | DBA, SEC, BE, PA (+ others per doc block) | **2026-09-01** | Approval block complete   |
| D3   | Collect ACF-001 signatures                                   | BE/ACG, SEC, PA (+ others per doc block)  | **2026-09-01** | Approval block complete   |
| D4   | If blocked: written risk accept + deferred items with owners | PA                                        | 2026-09-03     | No silent “almost signed” |

**Signature hygiene:**

- Sign only after reading fidelity pack for your role (§4 of GAP-IT-001 still applies).
- Signing Freeze v1.0 **does not automatically open** remaining product CRUD; opening remains a gated implementation decision.

**Checkpoint D:** Both freezes at Accepted v1.0 **or** explicit deferral plan that still meets ADR expiry handling.

---

### Workstream E — Close the loop (records and messaging)

| Task | Description                                                 | Owner   | Due          | Acceptance                        |
| ---- | ----------------------------------------------------------- | ------- | ------------ | --------------------------------- |
| E1   | Update `FREEZE_ACCEPTANCE_IDENTITY_TENANT.md` status        | PA      | 2026-09-08   | Status matches signatures         |
| E2   | Align README / engineering status / task records language   | PA      | 2026-09-08   | No “freeze accepted” false claims |
| E3   | Annotate ADR-012: superseded by freezes **or** renew/expire | PA      | ≤ 2026-09-15 | Status line accurate              |
| E4   | Optional: announce governance closure to eng team           | PA / PO | 2026-09-09   | Short note                        |

**Checkpoint E:** Governance DoD D1–D6 satisfied.

---

## 7. Role-specific “must-see” (minimal reading)

Reduce load; point people to the right 30–40 minutes.

### 7.1 PM Master — Database Architect

| Step | Document                                                                                                            | Est.      |
| ---- | ------------------------------------------------------------------------------------------------------------------- | --------- |
| 1    | [ADR-012 One-Page Summary](./ADR-012_ONE_PAGE_SUMMARY.md)                                                           | 5 min     |
| 2    | [ADR-012](../decisions/ADR-012-exception-identity-tenant-implementation.md) (Decision, Conditions, Risks, Approval) | 15 min    |
| 3    | GAP §4.1 (DBA checklist)                                                                                            | 5 min     |
| 4    | On Freeze track: DBF-001 approval block + **DBF fidelity matrix (C1)**                                              | 20–40 min |

**Must believe before countersign:** Exception is temporary; schema rework risk acknowledged; ADR ≠ DBF v1.0.

### 7.2 Masoud Salum — Security Lead

| Step | Document                                                                       | Est.   |
| ---- | ------------------------------------------------------------------------------ | ------ |
| 1    | One-page summary                                                               | 5 min  |
| 2    | ADR-012 Risks + Conditions                                                     | 10 min |
| 3    | [AUDIT-R2 live evidence](../task-records/AUDIT-R2-live-evidence-2026-07-14.md) | 5 min  |
| 4    | Freeze Acceptance residual risks                                               | 5 min  |
| 5    | On Freeze track: security residual note (C3) + ACF security schemes            | 20 min |

**Must believe before countersign:** Isolation model understood; residual not production-ready; product HTTP expansion still gated.

### 7.3 Rashid Mohammed — Backend Lead

| Step | Document                                                                       | Est.      |
| ---- | ------------------------------------------------------------------------------ | --------- |
| 1    | One-page summary                                                               | 5 min     |
| 2    | ADR-012 out-of-scope / HTTP NO GO for **product** routes                       | 10 min    |
| 3    | Module boundaries / public barrels (PLAT-005)                                  | 5 min     |
| 4    | On Freeze track: ACF fidelity matrix (C2) — what is implemented vs design-only | 20–30 min |

**Must believe before countersign:** Team will not treat exception as permanent license; remaining CRUD stays closed without freezes + plan.

---

## 8. Email templates

> **Transmission note:** This environment cannot send email. A human must copy, fill placeholders, send, and log in `outbox/SEND_LOG.md`.  
> Ready personalized drafts also exist under `docs/engineering/governance/outbox/` (refresh body with §2.2 honesty if those files pre-date AuthN/RBAC).

### 8.1 Template — ADR-012 countersignature (common skeleton)

**Subject:**

```text
ACTION REQUIRED by 2026-08-08 — Countersign ADR-012 (Identity & Tenant exception) | EduCore
```

**Body:**

```text
Dear [Name],

I am writing as Principal Architect / Governance Lead for EduCore to request your
formal countersignature on ADR-012.

1) Why this matters
ADR-012 is a time-bounded architecture exception. Identity & Tenant work proceeded
under Conditional Freeze before DBF-001 and ACF-001 received full human Freeze v1.0
acceptance. Multi-role countersignatures are required so Database, Security, and
Backend share ownership of residual risk before the formal review.

2) Critical clarification
Signing ADR-012 accepts the *exception only*.
It does NOT accept Database Freeze (DBF-001) or API Contract Freeze (ACF-001) as v1.0.
Tenant/user admin CRUD and other domain product APIs remain closed until freezes
(or a new ADR) allow them.

3) Engineering snapshot (for honesty)
Under the exception we now have provisional schema/RLS, AuthN routes under
/api/v1/auth/*, and RBAC foundation (roles, PolicyEvaluator, RequirePermission).
What remains closed: tenant/user CRUD, membership invite admin, role-admin HTTP,
and other bounded-context product APIs.

4) What to review (≈ 30–40 minutes)
  • docs/engineering/governance/ADR-012_ONE_PAGE_SUMMARY.md
  • docs/engineering/decisions/ADR-012-exception-identity-tenant-implementation.md
  • docs/engineering/governance/IDENTITY_TENANT_GOVERNANCE_COMPLETION_PLAN.md (this plan)
  • Role checklist in IDENTITY_TENANT_GOVERNANCE_ACTION_PLAN.md §4
  • docs/engineering/gates/FREEZE_ACCEPTANCE_IDENTITY_TENANT.md

5) Key dates
  • Countersign / reply deadline: Friday 2026-08-08
  • Review meeting: Thursday 2026-08-13, 10:00–11:15 EAT (invite attached)
  • Binding review-by: 2026-08-15
  • Exception hard expiry: 2026-09-15

6) Please reply by 2026-08-08 with one of:
  1. APPROVE — you will countersign with:
     “Countersigned — exception only; Freeze v1.0 still pending”
  2. CHANGES REQUESTED — list blockers (brief)
  3. DELEGATE — name an alternate with the same role authority

How to record approval: add Name, Date, and the phrase above on your Approval row
in ADR-012 (PR or direct edit via Governance Lead).

Thank you for protecting process integrity under time pressure.

Respectfully,
[Your name]
Principal Architect / Governance Lead — EduCore
```

### 8.2 Role-specific addenda (append before “Thank you”)

**PM Master (Database Architect):**

```text
Database-focused ask:
Please confirm you accept residual schema/migration rework risk if DBF-001 content
is corrected before Freeze v1.0, and that ADR-012 does not freeze the physical model.
DBF-001 Freeze signature is a separate track after a short fidelity matrix (migrations ↔ freeze).
```

**Masoud Salum (Security Lead):**

```text
Security-focused ask:
Please confirm residual tenancy/auth risks remain acceptable for *provisional* work,
with live isolation evidence on file, and that expanding product HTTP remains gated.
We will re-run live isolation after material schema change (RUN_LIVE_DB_TESTS=1).
```

**Rashid Mohammed (Backend Lead):**

```text
Backend-focused ask:
Please confirm module-boundary discipline and that teams will not open tenant/user CRUD
or role-admin APIs under “ADR-012 said we can implement.” Platform AuthN/RBAC routes
are intentional; additional product surface still requires freezes + implementation gates.
```

### 8.3 Soft reminder (2026-07-30)

**Subject:** `Reminder — ADR-012 countersignature due 2026-08-08 | EduCore`

```text
Dear [Name],

Friendly reminder: your ADR-012 countersignature (or CHANGES / DELEGATE reply) is due
Friday 2026-08-08. Pre-read is ~30–40 minutes (one-page summary + ADR Approval section).

Review meeting: 2026-08-13, 10:00–11:15 EAT.
Happy to jump on a 15-minute call if anything is unclear.

[Your name]
```

### 8.4 Final reminder (2026-08-05)

**Subject:** `Final reminder — ADR-012 countersign by 2026-08-08 | EduCore`

```text
Dear [Name],

Final reminder: without your reply by 2026-08-08 we risk a non-quorum review against
the ADR binding date of 2026-08-15. Please send APPROVE, CHANGES REQUESTED, or DELEGATE.

[Your name]
```

### 8.5 Freeze v1.0 signature request (send after fidelity packs — target 2026-08-25)

**Subject:** `ACTION REQUIRED by 2026-09-01 — Sign DBF-001 / ACF-001 Freeze v1.0 | EduCore Identity & Tenant`

```text
Dear [Name],

Following ADR-012 countersignatures and the 13 August review, we request your formal
human signature on the Identity & Tenant freezes:

  • DBF-001 — Database Freeze v1.0
  • ACF-001 — API Contract Freeze v1.0

This is separate from ADR-012. Freeze signatures accept the *design* as the binding
baseline for the slice. They do not, by themselves, authorize unrestricted production
cutover or every remaining OpenAPI route on the same day.

Enclosed / linked:
  1) Fidelity matrix (migrations ↔ DBF; OpenAPI ↔ implemented/closed routes)
  2) Security residual note
  3) DBF-001 and ACF-001 approval blocks
  4) FREEZE-ACC-001 (to be updated after signatures)

Deadline: Monday 2026-09-01 (to leave runway before ADR-012 hard expiry 2026-09-15).

Please reply APPROVE / CHANGES / DELEGATE and complete the signature block.

Respectfully,
[Your name]
Principal Architect / Governance Lead — EduCore
```

### 8.6 Escalation to Product Owner / sponsor (if stalled by 2026-08-05)

**Subject:** `Risk — ADR-012 countersignatures incomplete | need calendar priority | EduCore`

```text
Dear [PO/Sponsor],

ADR-012 hard-expires 2026-09-15. Countersignatures from Database, Security, and Backend
are still incomplete. Without them, our formal review (due 2026-08-15) lacks shared
risk ownership, and Freeze v1.0 (DBF/ACF) will compress into an unsafe last-minute rush.

Ask: please prioritize 30–40 minutes of review time for [names] this week, or confirm
delegates with equivalent authority.

I can provide a 10-minute brief for any stakeholder.

[Your name]
```

---

## 9. Master checklist (owners and dates)

Print or copy into a tracking board. Tick only with evidence (link / PR / SEND_LOG row).

### Phase 0 — Transmit (this week)

- [ ] **A1** Real emails collected — Owner: PA/PO — Due: **2026-07-16**
- [ ] **A2** Calendar invite finalized — Owner: PA — Due: **2026-07-16**
- [ ] **A3** Three emails sent — Owner: PA — Due: **2026-07-16** (latest **07-18**)
- [ ] SEND_LOG updated for each transmission — Owner: PA — Due: same day as send

### Phase 1 — Countersignatures

- [ ] Soft reminder sent if needed — Owner: PA — **2026-07-30**
- [ ] Final reminder sent if needed — Owner: PA — **2026-08-05**
- [ ] PM Master countersigned ADR-012 — Owner: DBA — **2026-08-08**
- [ ] Masoud Salum countersigned ADR-012 — Owner: SEC — **2026-08-08**
- [ ] Rashid Mohammed countersigned ADR-012 — Owner: BE — **2026-08-08**
- [ ] ADR-012 Approval table committed — Owner: PA — **2026-08-09**

### Phase 2 — Review

- [ ] Quorum confirmed — Owner: PA — **2026-08-10**
- [ ] Meeting held — Owner: PA — **≤ 2026-08-15** (target **08-13**)
- [ ] Minutes published — Owner: PA — **2026-08-16**

### Phase 3 — Freeze readiness

- [ ] DBF fidelity matrix — Owner: DBA+PA — **2026-08-22**
- [ ] ACF fidelity matrix — Owner: BE/ACG+PA — **2026-08-22**
- [ ] Security residual note — Owner: SEC+PA — **2026-08-22**
- [ ] Freeze text updates (if required) — Owner: DBA/ACG — **2026-08-27**

### Phase 4 — Freeze signatures

- [ ] Freeze signature request email sent — Owner: PA — **2026-08-25**
- [ ] DBF-001 signed Freeze v1.0 — Owners: per approval block — **2026-09-01**
- [ ] ACF-001 signed Freeze v1.0 — Owners: per approval block — **2026-09-01**

### Phase 5 — Close

- [ ] FREEZE-ACC-001 updated — Owner: PA — **2026-09-08**
- [ ] Status/README language reconciled — Owner: PA — **2026-09-08**
- [ ] ADR-012 status annotated (superseded / renewed / expired path) — Owner: PA — **≤ 2026-09-15**

---

## 10. Risks and mitigations

| ID  | Risk                                       | Likelihood      | Impact   | Mitigation                                                                                                                                                                  |
| --- | ------------------------------------------ | --------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Emails never leave outbox                  | High if unowned | Critical | Named PA send day; PO escalation 08-05; daily check until SENT                                                                                                              |
| R2  | One countersigner unavailable              | Medium          | High     | DELEGATE path; alternate with written authority; do not invent signatures                                                                                                   |
| R3  | Review slips past 2026-08-15               | Medium          | High     | Meeting 08-13; alt 08-12; PA calendar hold now                                                                                                                              |
| R4  | Freeze signatures slip past 09-01          | Medium          | High     | Fidelity packs early; async sign; escalate PO 08-28                                                                                                                         |
| R5  | Hard expiry 09-15 with freezes incomplete  | Medium          | Critical | Decision fork by **2026-09-05**: (a) complete freezes, (b) **written ADR renewal** with narrowed scope, (c) **stop** exception-covered expansion and freeze product surface |
| R6  | Team treats ADR as permanent “GO”          | High            | High     | Status language audits; BE enforces HTTP discipline; this plan’s honesty rule                                                                                               |
| R7  | Signers refuse Freeze due to drift         | Medium          | High     | C1–C4 before asking; update freeze text; never pressure “sign anyway”                                                                                                       |
| R8  | Over-claim AuthN as full product readiness | Medium          | High     | Explicit residual list in every freeze email; SEC residual note                                                                                                             |
| R9  | Calendar timezone / no-show                | Medium          | Medium   | EAT stated; .ics + async backup decisions for countersign only                                                                                                              |
| R10 | Governance docs diverge (multiple plans)   | Medium          | Medium   | This document is **completion** authority; GAP-IT-001 remains role-detail; packet remains send kit — cross-link, don’t fork timelines                                       |

### Decision fork if delayed (use by 2026-09-05)

```text
Are DBF-001 + ACF-001 fully signed?
  YES → Update FREEZE-ACC; annotate ADR-012 superseded; continue gated implementation
  NO  → Is residual risk still acceptable under a *narrowed* exception?
          YES → Written ADR-012 amendment (new expiry ≤ 30 days, explicit NO GO list)
          NO  → Stop exception-covered expansion; freeze further Identity/Tenant schema/API growth until freezes complete
```

---

## 11. Making the process efficient (recommendations)

| Practice                       | How                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| **One packet, one reply**      | Countersign emails already use APPROVE / CHANGES / DELEGATE — keep that pattern for freezes |
| **Async first**                | Prefer written sign-off; meetings only for conflicts                                        |
| **Time-box reading**           | One-page summary mandatory; full ADR optional for deep dive                                 |
| **Separate asks**              | Never mix “countersign exception” and “sign Freeze v1.0” in the same email                  |
| **Fidelity before signatures** | 2-page matrix saves multi-hour rework arguments                                             |
| **PA as scribe**               | Signers should not hunt for files; PA maintains SEND_LOG and Approval table                 |
| **15-minute office hours**     | Optional drop-in 2026-07-28 and 2026-08-06 for questions                                    |
| **Delegates early**            | If a lead is OOO in August, name delegate by **2026-07-25**                                 |
| **No surprise engineering**    | Between now and 09-15, avoid new Identity schema beyond P4 unless ADR-amended               |
| **Celebrate closure**          | Short eng note when freezes land — reinforces that process matters                          |

---

## 12. Relationship to other governance documents

| Document                                                                    | Role after this plan                                            |
| --------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **This plan (GCP-IT-001)**                                                  | **Completion authority** — timeline, checklists, templates, DoD |
| [GAP-IT-001](./IDENTITY_TENANT_GOVERNANCE_ACTION_PLAN.md)                   | Role “must-see” depth and pushback handling                     |
| [Countersignature Packet](./ADR-012_COUNTERSIGNATURE_PACKET.md)             | Packet index + send kit                                         |
| [outbox/](./outbox/)                                                        | Ready-to-send emails, .ics, SEND_LOG                            |
| [ADR-012](../decisions/ADR-012-exception-identity-tenant-implementation.md) | Binding decision + Approval table                               |
| [FREEZE-ACC-001](../gates/FREEZE_ACCEPTANCE_IDENTITY_TENANT.md)             | Conditional → Accepted transition record                        |

If dates conflict, **ADR-012 binding dates** (review-by **2026-08-15**, hard expiry **2026-09-15**) win over soft plan targets. Soft targets exist only to protect those hard dates.

---

## 13. Explicit non-goals of this plan

- Opening tenant/user CRUD or role-admin HTTP without Freeze v1.0 + implementation gate.
- Claiming production multi-tenant readiness.
- Replacing Architecture Freeze v1.0 kit records.
- AI-generated “signatures.”
- Silent renewal of ADR-012 past 2026-09-15.

---

## 14. Document control

| Version | Date       | Notes                                                                     |
| ------- | ---------- | ------------------------------------------------------------------------- |
| 1.0     | 2026-07-15 | Initial completion plan (countersignatures + freezes + templates + risks) |
| 1.1     | 2026-07-16 | §0 five immediate actions; P4b engineering honesty; send-day emphasis     |
| 2.0     | 2026-07-16 | Closed under SOLO-GOV-001 (solo-operator Freeze v1.0; outbox cancelled)   |

**Approval of this plan (process, not freeze):**

| Role                                  | Name | Date | Decision                       |
| ------------------------------------- | ---- | ---- | ------------------------------ |
| Principal Architect / Governance Lead |      |      | Proposed for execution         |
| Product Owner / Project Lead          |      |      | Calendar priority acknowledged |

---

_End of GCP-IT-001 — **send the outbox today**; do not let prepared materials age past the binding ADR window (review ≤ 2026-08-15; hard expiry 2026-09-15)._
