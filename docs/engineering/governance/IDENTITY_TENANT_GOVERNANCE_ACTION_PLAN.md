# Governance Action Plan — Identity & Tenant (ADR-012 Next Steps)

| Field           | Value                                                                                               |
| --------------- | --------------------------------------------------------------------------------------------------- |
| Document ID     | `GAP-IT-001`                                                                                        |
| Status          | **Active**                                                                                          |
| Created         | 2026-07-15                                                                                          |
| Owner           | Principal Architect / Governance Lead                                                               |
| Source          | [ADR-012](../decisions/ADR-012-exception-identity-tenant-implementation.md) — Next governance steps |
| Freeze posture  | **Conditional Freeze** (not Database / API Contract Freeze v1.0)                                    |
| Hard constraint | Nest Identity/Tenant **domain HTTP routes remain NO GO** until full freeze acceptance or a new ADR  |

---

## 1. Purpose

Execute the four mandatory next governance steps from ADR-012 so that:

1. The exception is reviewed on time (not left open-ended).
2. Multi-role countersignatures make the exception auditable beyond a single Principal Architect signature.
3. DBF-001 and ACF-001 reach **human Freeze v1.0 acceptance** (or an explicit renew/expire decision) before hard expiry.
4. Product HTTP surface stays closed until governance allows it.

This plan is **process and accountability**, not a license to open Nest domain routes.

---

## 2. Binding dates (do not slip without written amendment)

| Milestone                          | Deadline       | Failure mode if missed                                     |
| ---------------------------------- | -------------- | ---------------------------------------------------------- |
| Calendar invite for ADR-012 review | **2026-07-18** | Drift; August review becomes last-minute and underinformed |
| All ADR-012 countersignatures      | **2026-08-08** | Review meeting lacks quorum / shared risk ownership        |
| ADR-012 review meeting held        | **2026-08-15** | Violation of ADR review condition                          |
| DBF-001 human signatures complete  | **2026-09-01** | Insufficient runway before hard expiry                     |
| ACF-001 human signatures complete  | **2026-09-01** | Freeze v1.0 cannot supersede exception cleanly             |
| Freeze acceptance record update    | **2026-09-08** | Docs still say Conditional while signatures exist          |
| ADR-012 hard expiry                | **2026-09-15** | Exception lapses unless renewed or freezes fully accepted  |

---

## 3. Role map and decision rights

| Role                         | Symbol in this plan | Primary duty under ADR-012 / freezes                                     |
| ---------------------------- | ------------------- | ------------------------------------------------------------------------ |
| Principal Architect          | PA                  | Exception owner; convene review; track GAP; countersign DBF/ACF          |
| Database Architect           | DBA                 | ADR-012 countersign; DBF-001 fidelity; migration rework risk             |
| Security Lead                | SEC                 | ADR-012 countersign; RLS / tenancy residual risk; both freeze signatures |
| Backend Lead                 | BE                  | ADR-012 countersign; **enforce HTTP NO GO**; DBF + ACF signatures        |
| API Contract Guardian        | ACG                 | ACF-001 / OpenAPI fidelity; ACF signature                                |
| Product Owner / Project Lead | PO                  | Acknowledge Conditional status; unblock people time for reviews          |

Named countersigners (assigned 2026-07-15). Communication kit: [`ADR-012_COUNTERSIGNATURE_PACKET.md`](./ADR-012_COUNTERSIGNATURE_PACKET.md).

| Role | Assigned person                                    | Contact | Confirmed                       |
| ---- | -------------------------------------------------- | ------- | ------------------------------- |
| PA   | EduCore Principal Architect (Governance)           | —       | Yes (ADR-012 already signed)    |
| DBA  | PM Master                                          | —       | Named; countersignature pending |
| SEC  | Masoud Salum                                       | —       | Named; countersignature pending |
| BE   | Rashid Mohammed                                    | —       | Named; countersignature pending |
| ACG  | _to be named_ (may be Rashid Mohammed if dual-hat) |         | ☐                               |
| PO   | _to be named_                                      |         | ☐                               |

---

## 4. Role perspectives (what each countersigner will demand)

Use these checklists when soliciting signatures. Approvals should be withheld until the role’s **must-see** items are satisfiable or explicitly risk-accepted in writing.

### 4.1 Database Architect (DBA)

**Will care about:** schema fidelity to DBF-001, migration reversibility, provisional-vs-accepted divergence, catalog vs tenant-owned boundaries.

**Must-see before ADR-012 countersignature:**

- [ ] Diff of current migrations vs DBF-001 aggregate list (tenants, users, tenant_memberships, catalogs, RLS helpers).
- [ ] Clear statement that further tenant-owned tables beyond provisional set remain **NO GO**.
- [ ] Understanding that signing ADR-012 ≠ signing DBF-001 Freeze v1.0.

**Must-see before DBF-001 Freeze v1.0 signature:**

- [ ] Every implemented table/policy called out in DBF-001 (or explicit “defer to later revision” with owner).
- [ ] Down migrations exist and are operable for current slice.
- [ ] Residual schema rework risk accepted (Medium–High per ADR-012).

**Likely pushback:** “Implementation drifted ahead of freeze — require DBF-001 text updated _before_ I sign Freeze v1.0.”  
**PA response:** Correct process. Update draft first; only then request Freeze signature. ADR-012 may be countersigned earlier as exception-only.

### 4.2 Security Lead (SEC)

**Will care about:** RLS trust boundary (`educore_app` vs `educore_platform`), GUC spoofing, membership visibility, live isolation evidence, T1–T8 completeness, no premature HTTP attack surface.

**Must-see before ADR-012 countersignature:**

- [ ] AUDIT-R2 INSERT hardening summary + `AUDIT-R2-live-evidence-2026-07-14.md` (or successor).
- [ ] Confirmation Nest domain routes still absent.
- [ ] Explicit residual: partial T1–T8 / sessions not production-ready.

**Must-see before DBF-001 / ACF-001 Freeze v1.0 signatures:**

- [ ] Live isolation suite pass on current schema (`RUN_LIVE_DB_TESTS=1`).
- [ ] OpenAPI `securitySchemes` + `x-permissions` adequate for authz design.
- [ ] Written acceptance of residual tenancy risks **or** outstanding issues filed with owners/dates.

**Likely pushback:** “Do not open HTTP until authn/session and permission enforcement design are signed in ACF.”  
**PA response:** Aligns with ADR-012 out-of-scope. Freeze signatures authorize design; route opening still needs post-freeze implementation plan / gate — not same day as signature unless a GO gate explicitly says so.

### 4.3 Backend Lead (BE)

**Will care about:** module boundaries, no accidental controllers/routes, OpenAPI vs Nest alignment later, CI/boundary green, team discipline under Conditional Freeze.

**Must-see before ADR-012 countersignature:**

- [ ] Repo scan / convention: Identity & Tenant **business** HTTP controllers not registered.
- [ ] Public barrels still do not export repositories (PLAT-005 / AUDIT-R3).
- [ ] Clear engineering message: scaffolding yes, product APIs no.

**Must-see before ACF-001 Freeze v1.0 signature:**

- [ ] ACF-001 + OpenAPI reviewed for implementability (status codes, errors, auth headers, idempotency notes).
- [ ] IMP-001 phases ordered so HTTP comes only **after** Freeze v1.0 acceptance recorded.

**Likely pushback:** “Pressure to ‘just add login’ for demos.”  
**PA response:** Demo = mocks / non-domain stubs only; any real Identity HTTP increment requires full freeze **or** a **new** ADR naming that increment. BE owns enforcement in code review / PR checklist.

---

## 5. Four workstreams (ADR-012 next steps)

Dependency sketch:

```
WS0: Name role holders (immediate)
        │
        ├── WS1: Schedule review meeting (invite ≤ 2026-07-18)
        │
        ├── WS2: Collect ADR-012 countersignatures (≤ 2026-08-08)
        │         └── feeds WS1 meeting quality
        │
        ├── WS3: Drive DBF-001 + ACF-001 human Freeze signatures (≤ 2026-09-01)
        │         └── supersedes need for exception when both Accepted v1.0
        │
        └── WS4: Continuous Nest HTTP NO GO enforcement (now → until supersession)
```

---

### Workstream 1 — Schedule ADR-012 review meeting (before 2026-08-15)

| Item                            | Detail                                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Owner**                       | PA (calendar) + PO (ensure attendance)                                                         |
| **Start by**                    | 2026-07-16                                                                                     |
| **Done when**                   | Invite sent by **2026-07-18**; meeting held by **2026-08-15**; minutes filed                   |
| **Attendees (required)**        | PA, DBA, SEC, BE, ACG                                                                          |
| **Attendees (optional)**        | PO                                                                                             |
| **Duration**                    | 60–90 minutes                                                                                  |
| **Pre-read (send with invite)** | ADR-012; FREEZE-ACC-001; AUDIT-R2 live evidence; this GAP; DBF-001 + ACF-001 approval sections |

#### Acceptance criteria

- [ ] Calendar event exists with all required roles accepted or explicitly delegated.
- [ ] Agenda attached (see §7.2).
- [ ] Decision outcomes recorded within 24 hours: **Renew / Amend / Expire** exception; note status of DBF/ACF signatures; Nest HTTP posture reaffirmed.

#### Risk if delayed

August date becomes ceremonial; countersignatures incomplete; hard expiry approached without a documented renew/expire path → audit finding and possible quarantine of provisional schema.

---

### Workstream 2 — Collect ADR-012 countersignatures (DBA, SEC, BE)

| Item          | Detail                                                                           |
| ------------- | -------------------------------------------------------------------------------- |
| **Owner**     | PA sends packet; each role signs own row                                         |
| **Start by**  | 2026-07-16 (same day as naming owners)                                           |
| **Done when** | All three rows filled in ADR-012 Approval table by **2026-08-08**                |
| **Artifact**  | `docs/engineering/decisions/ADR-012-exception-identity-tenant-implementation.md` |

#### Execution sequence

1. PA assigns **named humans** to DBA / SEC / BE (table in §3).
2. PA sends **Countersignature packet** (§7.1) with 5 business-day SLA to reply Approve / Request changes / Abstain-with-reason.
3. Each signer adds Name, Date, Signature phrase: `Countersigned — exception only; Freeze v1.0 still pending`.
4. PA updates ADR-012 revision history (e.g. v1.2) when all three complete.
5. Incomplete by 2026-08-01 → PA escalates to PO; incomplete by 2026-08-08 → still hold review meeting, but minute **unsigned risk** and limit further exception renewals until closed.

#### Acceptance criteria

- [ ] DBA, SEC, BE names appear on ADR-012 (not blank roles).
- [ ] Each signature text makes clear it is **exception-only**.
- [ ] OPEN questions from role checklists (§4) either closed or logged as residuals with owners.

#### Risk if delayed

Single-person governance (PA-only acceptance) repeats the audit’s G2 criticism pattern; Security/DB ownership of provisional schema is weak under scrutiny.

---

### Workstream 3 — Drive human signatures on DBF-001 and ACF-001 (before 2026-09-15)

| Item                             | Detail                                                                                                                                                |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Owner**                        | PA program-manages; DBA owns DBF content; ACG/BE own ACF content; SEC signs both                                                                      |
| **Content freeze review sprint** | 2026-07-21 → 2026-08-22                                                                                                                               |
| **Signature collection**         | 2026-08-25 → 2026-09-01                                                                                                                               |
| **Done when**                    | Both approval blocks complete **and** `FREEZE_ACCEPTANCE_IDENTITY_TENANT.md` updated to Accepted v1.0 (or explicit blockers listed) by **2026-09-08** |
| **Hard stop**                    | 2026-09-15 (ADR-012 expiry)                                                                                                                           |

#### Phase A — Align documents to reality (before asking for Freeze signatures)

| Task                                                                      | Owner    | Deadline   | Output                               |
| ------------------------------------------------------------------------- | -------- | ---------- | ------------------------------------ |
| DBF-001: reconcile to migrations (memberships, RLS roles, grants)         | DBA      | 2026-08-08 | Updated DBF draft + change log       |
| ACF-001 + OpenAPI: reconcile auth schemes / x-permissions / resource list | ACG + BE | 2026-08-08 | Updated ACF + OpenAPI                |
| Re-run live isolation after any schema doc conflict resolution            | BE + SEC | 2026-08-15 | Evidence note linked from FREEZE-ACC |
| Write one-page “diff: design vs implemented” for reviewers                | PA       | 2026-08-18 | Attached to signature request        |

#### Phase B — Signature ceremony (Freeze v1.0)

**DBF-001 required signers:** Database Architect, Principal Architect, Security, Backend Lead

**ACF-001 required signers:** Principal Architect, Backend Lead, Security, API Contract Guardian

Suggested order (minimize thrash):

1. DBA signs DBF-001 (content owner).
2. ACG signs ACF-001 (contract owner).
3. SEC signs DBF-001 then ACF-001 (security across both).
4. BE signs DBF-001 then ACF-001 (implementability + HTTP gate awareness).
5. PA signs both last (integrity of process + consistency).

Signature phrase example: `Accepted — Database Freeze v1.0 — Identity & Tenant Slice` / `Accepted — API Contract Freeze v1.0 — Identity & Tenant Slice`.

#### Phase C — Close the governance loop

- [ ] Update `docs/engineering/gates/FREEZE_ACCEPTANCE_IDENTITY_TENANT.md` status to **Accepted v1.0** (or list remaining NO GOs with owners).
- [ ] Amend ADR-012 status note: exception **superseded for slice** (historical record retained) when both freezes Accepted.
- [ ] Only then open IMP-001 tasks that authorize Nest domain HTTP via an explicit GO gate (separate from this GAP).

#### Acceptance criteria

- [ ] No blank cells in DBF-001 / ACF-001 approval blocks.
- [ ] FREEZE-ACC-001 matches reality.
- [ ] ADR-012 either superseded by freezes or formally **renewed/amended** with new expiry before 2026-09-15.

#### Risk if delayed

Hard expiry without renewal → provisional implementation loses governance cover; may require quarantine, halt of all Identity persistence work, or emergency ADR amendment under time pressure.

---

### Workstream 4 — Keep Nest Identity/Tenant HTTP routes closed

| Item              | Detail                                                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Owner**         | BE (enforcement); PA (policy); all reviewers (PRs)                                                                                  |
| **Start**         | Immediate (2026-07-15)                                                                                                              |
| **Ends when**     | FREEZE-ACC-001 = Accepted v1.0 **and** an IMP / gate document explicitly authorizes a named route increment — **or** a new ADR does |
| **Standing rule** | No login, tenant CRUD, membership invite, RBAC admin, or other Identity/Tenant **product** HTTP under ADR-012 alone                 |

#### Controls (mandatory)

| Control                  | Owner | How                                                                                                             |
| ------------------------ | ----- | --------------------------------------------------------------------------------------------------------------- |
| PR checklist gate        | BE    | Use / keep `docs/engineering/templates/PR_CHECKLIST_IDENTITY_TENANT.md`; reject PRs that add domain controllers |
| Codeowners / review rule | BE    | Require BE or PA approval on `apps/api/src/modules/identity*` / `tenant*` route files if created                |
| Boundary / CI            | BE    | `npm run check` green; no silent route registration                                                             |
| Docs messaging           | PA    | Status language: “ADR-012 exception / Conditional Freeze” — never “Freeze accepted” until WS3 done              |
| Escalation               | PA    | Any demo request for real Identity HTTP → PO + PA decision recorded; default = refuse                           |

#### Acceptance criteria (continuous)

- [ ] Spot-check monthly until freeze acceptance: no Identity/Tenant domain controllers serving product APIs.
- [ ] Any exception to this workstream requires a **new ADR** or full Freeze v1.0 + GO gate (not informal chat).

#### Risk if delayed / ignored

Premature attack surface under incomplete authz; audit regression; ADR-012 conditions violated even if signatures exist.

---

## 6. Week-by-week timeline (compact)

| Window                 | Focus                                                              | Checkpoint                            |
| ---------------------- | ------------------------------------------------------------------ | ------------------------------------- |
| **2026-07-15 → 07-18** | Name role holders; send WS1 invite; start WS2 packet; announce WS4 | Invite sent                           |
| **2026-07-21 → 08-08** | DBF/ACF content alignment (WS3 Phase A); collect countersignatures | ADR-012 fully countersigned           |
| **2026-08-11 → 08-15** | Hold ADR-012 review meeting; minute renew/amend/expire             | Meeting held + minutes                |
| **2026-08-18 → 09-01** | Freeze signature ceremony (WS3 Phase B)                            | DBF + ACF signed                      |
| **2026-09-02 → 09-08** | Update FREEZE-ACC; supersede ADR-012 exception for slice           | Accepted v1.0 or renewal ADR          |
| **2026-09-15**         | Hard expiry — no silent extension                                  | Written renew **or** freezes accepted |

---

## 7. Templates

### 7.1 Email / message — ADR-012 countersignature request

**Subject:** ACTION REQUIRED by 2026-08-08 — Countersign ADR-012 (exception only)

```
To: [DBA], [SEC], [BE]
Cc: [PO], [ACG]

We need your countersignature on ADR-012 (Identity & Tenant time-bounded exception).

This is NOT Freeze v1.0 acceptance of DBF-001 / ACF-001.
It confirms you accept the exception’s scope, conditions, risks, and expiry.

Pre-read (≈ 20–30 min):
1) docs/engineering/decisions/ADR-012-exception-identity-tenant-implementation.md
2) docs/engineering/gates/FREEZE_ACCEPTANCE_IDENTITY_TENANT.md
3) docs/engineering/governance/IDENTITY_TENANT_GOVERNANCE_ACTION_PLAN.md (§4 your role)
4) Your role checklist evidence links (AUDIT-R2 live evidence for SEC; migrations vs DBF for DBA; route absence for BE)

Reply by 2026-08-08 with one of:
- APPROVE — I will sign “Countersigned — exception only; Freeze v1.0 still pending”
- CHANGES REQUESTED — list blockers
- DELEGATE — name alternate with same role authority

Review meeting target: on/before 2026-08-15 (invite follows / attached).

— Principal Architect / Governance Lead
```

### 7.2 Meeting agenda — ADR-012 review (≤ 2026-08-15)

**Title:** ADR-012 Exception Review — Identity & Tenant  
**Duration:** 75 minutes

| Time  | Topic                                                               | Owner    | Outcome needed        |
| ----- | ------------------------------------------------------------------- | -------- | --------------------- |
| 0–5   | Purpose: exception ≠ freeze v1.0                                    | PA       | Shared framing        |
| 5–15  | Status of countersignatures                                         | PA       | Gaps named            |
| 15–30 | Security residual (RLS, live tests, HTTP closed)                    | SEC      | Risk accept / actions |
| 30–45 | Schema / DBF fidelity & rework risk                                 | DBA      | Actions for WS3       |
| 45–55 | Backend scope control & OpenAPI readiness                           | BE / ACG | Actions for WS3       |
| 55–70 | Decision: Renew / Amend / Expire; path to Freeze v1.0 by 2026-09-01 | All      | Recorded vote         |
| 70–75 | Nest HTTP NO GO reaffirmation; owners for open actions              | PA       | Minutes               |

**Minutes template fields:** attendees; decision; open actions (owner + date); Nest HTTP posture; next check-in date.

### 7.3 Email / message — Freeze signature request (DBF-001 / ACF-001)

**Subject:** ACTION REQUIRED by 2026-09-01 — Sign Identity & Tenant Freeze v1.0 (DBF-001 / ACF-001)

```
To: [role-specific]
Cc: PA, PO

After ADR-012 review and document alignment, we request Freeze v1.0 signature on:

- DBF-001: docs/engineering/database-freeze/DBF-001-identity-tenant-slice.md
- ACF-001: docs/engineering/api-contract-freeze/ACF-001-identity-tenant-slice.md
  (+ OpenAPI sibling)

Attached: one-page design-vs-implemented diff; latest live isolation evidence link.

Signing means the design is accepted as Freeze v1.0 for this slice.
It does NOT by itself open Nest domain HTTP — that still requires an explicit implementation GO gate after both freezes are signed.

Please sign your approval block row with Name / Date / “Accepted — … Freeze v1.0 …”.

Deadline: 2026-09-01 (ADR-012 hard expiry 2026-09-15).

— Principal Architect
```

### 7.4 Standing engineering notice — HTTP NO GO

```
NOTICE (standing until FREEZE-ACC-001 = Accepted v1.0 + GO gate):

Identity & Tenant NestJS domain HTTP routes (login, tenant CRUD, membership invite,
RBAC admin, etc.) are FORBIDDEN under ADR-012 / Conditional Freeze.

Allowed: provisional persistence, RLS tests, OpenAPI design alignment, CI/tooling.
Forbidden: product route registration for this slice.

Violations: reject PR; escalate to Backend Lead + Principal Architect.
```

---

## 8. Risks summary (delay / non-compliance)

| Risk                                  | Impact   | Trigger                      | Mitigation                                                        |
| ------------------------------------- | -------- | ---------------------------- | ----------------------------------------------------------------- |
| Review meeting not held by 2026-08-15 | High     | Calendar neglect             | Invite by 2026-07-18; PO escalation 2026-08-01                    |
| Countersignatures incomplete          | High     | Unnamed owners / busy roles  | Name people in §3 within 48h; SLA + escalate                      |
| Freezes unsigned at 2026-09-15        | Critical | Content thrash / no ceremony | Dual-track WS3; PA last-signer after content lock                 |
| Silent HTTP “for demo”                | Critical | Product pressure             | WS4 controls; PR checklist; new ADR required                      |
| Docs say “freeze accepted” falsely    | High     | Messaging drift              | PA owns status language; FREEZE-ACC updates only after signatures |
| Exception normalization               | High     | Repeated prompt GOs          | Refuse; cite ADR-012 condition #4                                 |

---

## 9. Tracking checklist (print / copy)

### Immediate (this week)

- [ ] Name DBA, SEC, BE, ACG, PO in §3
- [ ] Send calendar invite for ADR-012 review (≤ 2026-07-18)
- [ ] Send countersignature packet (§7.1)
- [ ] Publish HTTP NO GO notice (§7.4) to eng channel / README status note

### Before review meeting

- [ ] ADR-012 countersigned by DBA, SEC, BE
- [ ] Pre-read bundle confirmed received
- [ ] Agenda confirmed

### By hard expiry path

- [ ] Review meeting minutes filed
- [ ] DBF-001 signed (all roles)
- [ ] ACF-001 signed (all roles)
- [ ] FREEZE-ACC-001 updated
- [ ] ADR-012 superseded note or renewal amendment
- [ ] Nest HTTP still closed unless GO gate opened

---

## 10. References

| Document                      | Path                                                                                   |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| ADR-012                       | `docs/engineering/decisions/ADR-012-exception-identity-tenant-implementation.md`       |
| Conditional freeze acceptance | `docs/engineering/gates/FREEZE_ACCEPTANCE_IDENTITY_TENANT.md`                          |
| DBF-001                       | `docs/engineering/database-freeze/DBF-001-identity-tenant-slice.md`                    |
| ACF-001                       | `docs/engineering/api-contract-freeze/ACF-001-identity-tenant-slice.md`                |
| OpenAPI                       | `docs/engineering/api-contract-freeze/openapi/acf-001-identity-tenant.openapi.yaml`    |
| IMP-001                       | `docs/engineering/implementation-plans/IMP-001-identity-tenant-implementation-plan.md` |
| PR checklist                  | `docs/engineering/templates/PR_CHECKLIST_IDENTITY_TENANT.md`                           |
| Live RLS evidence             | `docs/engineering/task-records/AUDIT-R2-live-evidence-2026-07-14.md`                   |

---

## 11. Revision history

| Version | Date       | Notes                                            |
| ------- | ---------- | ------------------------------------------------ |
| 1.0     | 2026-07-15 | Initial GAP covering all four ADR-012 next steps |

---

## 12. Recommended first action (urgent)

**Name the human owners for Database Architect, Security Lead, and Backend Lead, then send the ADR-012 review calendar invite (target meeting on/before 2026-08-15) together with the countersignature packet — all within 48 hours (complete by 2026-07-18).**

Everything else (Freeze signature ceremony, content alignment) depends on identifiable people being on the calendar and accountability chain. HTTP NO GO is already in force; do not wait for a meeting to enforce it, but the governance clock starts with **named owners + scheduled review**.
