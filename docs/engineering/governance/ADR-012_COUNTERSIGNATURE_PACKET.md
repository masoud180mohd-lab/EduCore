# ADR-012 Countersignature Packet & Communication Kit

> **RETIRED (SOLO-GOV-003, 2026-08-15):** This packet describes emails, countersignatures, calendar invites, and a video meeting for people who were never staffed. Owner directive: signature/video gates are deleted kit-wide. Kept as history only — **do not act on anything below.** The `outbox/` files it references have been deleted. See `SOLO-GOV-003-signature-video-gates-retired.md`.

| Field       | Value                                                                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Document ID | `ADR-012-CSK-001`                                                                                                                      |
| Created     | 2026-07-15                                                                                                                             |
| Owner       | Principal Architect / Governance Lead                                                                                                  |
| Purpose     | Ready-to-send emails, 1-page summary, packet index, calendar invite                                                                    |
| Related     | [ADR-012](../decisions/ADR-012-exception-identity-tenant-implementation.md), [GAP-IT-001](./IDENTITY_TENANT_GOVERNANCE_ACTION_PLAN.md) |

---

## Recommended send & meeting dates

| Action                                    | Recommended date                                      | Notes                                                                       |
| ----------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------- |
| Send all three countersignature emails    | **Thursday 2026-07-16** (or Friday 2026-07-17 latest) | Meets GAP invite deadline of 2026-07-18                                     |
| Send calendar invite (same day as emails) | **2026-07-16**                                        | Include packet links in invite body                                         |
| Soft reminder if no reply                 | **2026-07-30**                                        | Mid-cycle nudge                                                             |
| Final reminder                            | **2026-08-05**                                        | Before hard countersign deadline                                            |
| **Countersignature deadline**             | **Friday 2026-08-08**                                 | Reply APPROVE / CHANGES / DELEGATE                                          |
| **ADR-012 Review Meeting**                | **Thursday 2026-08-13, 10:00–11:15 EAT**              | Buffer before hard review date 2026-08-15; avoid Monday-after-weekend crush |
| Alternate meeting slot                    | **Tuesday 2026-08-12, 14:00–15:15 EAT**               | If Thu conflicts                                                            |
| Hard review-by date (ADR binding)         | **2026-08-15**                                        | Meeting must be held on or before this day                                  |
| ADR hard expiry                           | **2026-09-15**                                        | Separate track: Freeze v1.0 signatures                                      |

**Why 13 August:** Leaves two calendar days before the ADR binding review deadline for minutes, follow-ups, and one reschedule if urgently needed.

---

## Countersignature Packet — document checklist

Attach or link **all** of the following when sending emails / calendar invite. Order = recommended reading order.

| #   | Document                                     | Path                                                                             | Why included                                       | Est. read time           |
| --- | -------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------ |
| 1   | **ADR-012 (full)**                           | `docs/engineering/decisions/ADR-012-exception-identity-tenant-implementation.md` | Document to countersign                            | 15–20 min                |
| 2   | **ADR-012 one-page summary**                 | `docs/engineering/governance/ADR-012_ONE_PAGE_SUMMARY.md`                        | Fast orientation                                   | 3–5 min                  |
| 3   | **Governance Action Plan**                   | `docs/engineering/governance/IDENTITY_TENANT_GOVERNANCE_ACTION_PLAN.md`          | Owners, deadlines, role checklists                 | 10 min (own §4)          |
| 4   | **Freeze Acceptance (Conditional)**          | `docs/engineering/gates/FREEZE_ACCEPTANCE_IDENTITY_TENANT.md`                    | Freeze ≠ Accepted v1.0; GO/NO GO                   | 8 min                    |
| 5   | **Live RLS evidence (SECURITY focus)**       | `docs/engineering/task-records/AUDIT-R2-live-evidence-2026-07-14.md`             | Isolation evidence for residual risk               | 5 min                    |
| 6   | **DBF-001 (for awareness; not signing yet)** | `docs/engineering/database-freeze/DBF-001-identity-tenant-slice.md`              | Context for DBA; Freeze signature is a later track | skim §1 + approval block |
| 7   | **ACF-001 (for awareness; not signing yet)** | `docs/engineering/api-contract-freeze/ACF-001-identity-tenant-slice.md`          | Context for BE/ACG; Freeze signature later         | skim §1 + approval block |

**Optional deep-dives (link only if requested):**

- `docs/engineering/task-records/AUDIT-R2-rls-hardening-live-isolation.md`
- `docs/engineering/task-records/IMP-001-P1-tenant-memberships-openapi.md`
- OpenAPI: `docs/engineering/api-contract-freeze/openapi/acf-001-identity-tenant.openapi.yaml`

**How to sign ADR-012:** Add your Name, Date, and signature phrase on the Approval row for your role:

> `Countersigned — exception only; Freeze v1.0 still pending`

---

## Master email template (base)

Use this as the shared skeleton; personalized variants below add a short role-specific paragraph.

**From:** Principal Architect / Governance Lead — EduCore  
**To:** [Role holder]  
**Cc:** Countersigners (optional same thread) + Product Owner if assigned  
**Subject:** ACTION REQUIRED by 2026-08-08 — Countersign ADR-012 (Identity & Tenant exception)

```
Dear [Name],

I am writing to request your countersignature on ADR-012 — a time-bounded architecture
exception for Identity & Tenant provisional work under Conditional Freeze.

Why you are receiving this
We already have Principal Architect acceptance (2026-07-15). Multi-role countersignatures
are required before the formal ADR-012 review so Database, Security, and Backend share
ownership of the exception’s conditions and residual risks.

Important clarification
Signing ADR-012 accepts the exception only. It does not accept Database Freeze (DBF-001)
or API Contract Freeze (ACF-001) as v1.0. Nest Identity/Tenant product HTTP routes remain
closed until full freeze acceptance or a new ADR.

What is attached / linked (Countersignature Packet)
1. ADR-012 (full decision) — document to sign
2. ADR-012 one-page summary
3. Governance Action Plan (GAP-IT-001)
4. Freeze Acceptance record (Conditional)
5. Live RLS evidence note
6. DBF-001 and ACF-001 (context only — Freeze signatures are a later track)

Key dates
• Countersignature reply deadline: Friday 2026-08-08
• ADR-012 Review Meeting: Thursday 2026-08-13, 10:00–11:15 EAT (invite separate)
• Binding review-by date: 2026-08-15
• Exception hard expiry: 2026-09-15

Call to action (please reply by 2026-08-08 with one of)
1. APPROVE — I will countersign with: “Countersigned — exception only; Freeze v1.0 still pending”
2. CHANGES REQUESTED — list blockers (briefly)
3. DELEGATE — name an alternate with the same role authority

Please also accept the calendar invite for the 2026-08-13 review meeting (or propose the
alternate slot). Pre-read the one-page summary first; use the full ADR before signing.

Thank you for protecting EduCore’s freeze governance.

Kind regards,
EduCore Principal Architect / Governance Lead
EduCore
```

**Production copies (ready to paste):** `docs/engineering/governance/outbox/`

---

## Personalized email 1 — PM Master (Database Architect)

**To:** PM Master  
**Role:** Database Architect  
**Subject:** ACTION REQUIRED by 2026-08-08 — Countersign ADR-012 (Database Architect)

```
Dear PM Master,

Please countersign ADR-012 in your capacity as Database Architect for EduCore’s Identity
& Tenant slice.

Why your signature matters
Provisional schema (tenants, users, memberships, RLS helpers) landed ahead of formal
DBF-001 Freeze v1.0. ADR-012 records that sequencing exception honestly. Your
countersignature confirms you accept the temporary deviation and the migration-rework
risk — not that DBF-001 is fully accepted.

Focus your pre-read on
• ADR-012 one-page summary, then full ADR (In scope / Out of scope / Expiry)
• GAP-IT-001 §4.1 (Database Architect checklist)
• Freeze Acceptance record (Conditional GO / NO GO)
• Skim DBF-001 aggregates vs current migrations (awareness for later Freeze signature)

Key dates
• Reply / countersign by: Friday 2026-08-08
• Review meeting: Thursday 2026-08-13, 10:00–11:15 EAT
• Binding review-by: 2026-08-15 | Hard expiry: 2026-09-15

Call to action
Reply by 2026-08-08 with APPROVE, CHANGES REQUESTED, or DELEGATE, then add your Name /
Date / “Countersigned — exception only; Freeze v1.0 still pending” on the Database
Architect row in ADR-012. Please accept the review meeting invite.

Packet paths are listed in:
docs/engineering/governance/ADR-012_COUNTERSIGNATURE_PACKET.md

Kind regards,
EduCore Principal Architect / Governance Lead
```

**Production copy:** `outbox/2026-07-15-email-pm-master-database-architect.md`

---

## Personalized email 2 — Masoud Salum (Security Lead)

**To:** Masoud Salum  
**Role:** Security Lead  
**Subject:** ACTION REQUIRED by 2026-08-08 — Countersign ADR-012 (Security Lead)

```
Dear Masoud,

Please countersign ADR-012 in your capacity as Security Lead for EduCore.

Why your signature matters
The Independent Audit flagged RLS trust-boundary and process risks. Mitigations
(INSERT hardening, live isolation evidence, membership helpers) are recorded under
ADR-012, but residual tenancy risk remains and product HTTP is still closed. We need
Security’s explicit acceptance of the time-bounded exception before the August review.

Focus your pre-read on
• ADR-012 one-page summary, then Risks / Mitigations / Conditions
• Live RLS evidence: docs/engineering/task-records/AUDIT-R2-live-evidence-2026-07-14.md
• Freeze Acceptance residual risks
• GAP-IT-001 §4.2 (Security checklist)
• Confirm for yourself: Nest Identity/Tenant domain HTTP remains NO GO

Key dates
• Reply / countersign by: Friday 2026-08-08
• Review meeting: Thursday 2026-08-13, 10:00–11:15 EAT
• Binding review-by: 2026-08-15 | Hard expiry: 2026-09-15

Call to action
Reply by 2026-08-08 with APPROVE, CHANGES REQUESTED, or DELEGATE, then sign the Security
row in ADR-012: “Countersigned — exception only; Freeze v1.0 still pending.” Please
accept the review meeting invite — we will explicitly reaffirm HTTP NO GO and residual
RLS risk in that session.

Packet index:
docs/engineering/governance/ADR-012_COUNTERSIGNATURE_PACKET.md

Kind regards,
EduCore Principal Architect / Governance Lead
```

**Production copy:** `outbox/2026-07-15-email-masoud-salum-security-lead.md`

---

## Personalized email 3 — Rashid Mohammed (Backend Lead)

**To:** Rashid Mohammed  
**Role:** Backend Lead  
**Subject:** ACTION REQUIRED by 2026-08-08 — Countersign ADR-012 (Backend Lead)

```
Dear Rashid,

Please countersign ADR-012 in your capacity as Backend Lead for EduCore.

Why your signature matters
Under this exception, persistence scaffolding is allowed; Nest Identity/Tenant product
HTTP routes (login, tenant CRUD, membership invite, RBAC admin, etc.) are not. Backend
Lead owns enforcement in reviews and PRs so “demo pressure” does not violate Conditional
Freeze.

Focus your pre-read on
• ADR-012 one-page summary — especially Out of scope / Forbidden
• GAP-IT-001 §4.3 and Workstream 4 (HTTP NO GO controls)
• Freeze Acceptance Allowed vs Forbidden work
• Skim ACF-001 + OpenAPI (context only; Freeze signature is later)
• Confirm no Identity/Tenant domain controllers are opened under this ADR alone

Key dates
• Reply / countersign by: Friday 2026-08-08
• Review meeting: Thursday 2026-08-13, 10:00–11:15 EAT
• Binding review-by: 2026-08-15 | Hard expiry: 2026-09-15

Call to action
Reply by 2026-08-08 with APPROVE, CHANGES REQUESTED, or DELEGATE, then sign the Backend
Lead row in ADR-012: “Countersigned — exception only; Freeze v1.0 still pending.” Please
accept the review meeting invite and be prepared to confirm HTTP closure controls.

Packet index:
docs/engineering/governance/ADR-012_COUNTERSIGNATURE_PACKET.md

Kind regards,
EduCore Principal Architect / Governance Lead
```

**Production copy:** `outbox/2026-07-15-email-rashid-mohammed-backend-lead.md`

---

## Calendar invite — ADR-012 Review Meeting

**Title:** EduCore — ADR-012 Exception Review (Identity & Tenant)

**When:** Thursday 2026-08-13 · 10:00–11:15 EAT (75 minutes)  
**Alternate:** Tuesday 2026-08-12 · 14:00–15:15 EAT

**Required attendees:**

- Principal Architect / Governance Lead (host)
- PM Master — Database Architect
- Masoud Salum — Security Lead
- Rashid Mohammed — Backend Lead
- API Contract Guardian (if assigned separately; otherwise Backend Lead covers)

**Optional:** Product Owner / Project Lead

**Location:** Video link TBD — set before send (`outbox/2026-08-13-adr-012-review-meeting.ics`)

**Description (paste into invite body):**

```
Purpose
Review ADR-012 (time-bounded Identity & Tenant exception under Conditional Freeze).
Decide Renew / Amend / Expire. Reaffirm Nest Identity/Tenant HTTP NO GO. Confirm path
to DBF-001 / ACF-001 Freeze v1.0 before hard expiry 2026-09-15.

This meeting does not by itself accept Freeze v1.0 or open product HTTP routes.

Pre-read (required)
1) docs/engineering/governance/ADR-012_ONE_PAGE_SUMMARY.md
2) docs/engineering/decisions/ADR-012-exception-identity-tenant-implementation.md
3) docs/engineering/gates/FREEZE_ACCEPTANCE_IDENTITY_TENANT.md
4) Own role section in docs/engineering/governance/IDENTITY_TENANT_GOVERNANCE_ACTION_PLAN.md

Please countersign ADR-012 by Friday 2026-08-08 (before this meeting).

Agenda (75 min)
0–5   Framing: exception ≠ Freeze v1.0 (Host)
5–15  Countersignature status (Host)
15–30 Security residuals — RLS, live evidence, HTTP closed (Masoud)
30–45 Schema / DBF fidelity & rework risk (PM Master)
45–55 Backend scope control & OpenAPI readiness (Rashid)
55–70 Decision: Renew / Amend / Expire + Freeze v1.0 path by 2026-09-01 (All)
70–75 Actions, owners, Nest HTTP NO GO reaffirmation (Host)

Outcomes required
• Recorded decision on the exception
• Named follow-ups with owners and dates
• Explicit HTTP NO GO confirmation in minutes

Binding review-by date per ADR-012: 2026-08-15.
```

---

## Send checklist (operator)

- [x] Update GAP role table with PM Master / Masoud Salum / Rashid Mohammed
- [x] Fill ADR-012 Approval **Name** columns for the three countersigners (signature still pending)
- [x] Produce ready-to-send outbox emails + `.ics` (`outbox/`)
- [x] Remove `[Your name]` placeholders (signer = EduCore Principal Architect / Governance Lead)
- [ ] **Human:** Send three personalized emails on **2026-07-16** (see `outbox/SEND_LOG.md`)
- [ ] **Human:** Send calendar invite same day (primary **2026-08-13**) — replace `example.invalid` emails + video link
- [ ] Confirm packet links resolve in your environment (Git / shared drive)
- [ ] Log replies in a simple tracker (APPROVE / CHANGES / DELEGATE)
- [ ] Soft reminder **2026-07-30**; final reminder **2026-08-05**
- [ ] After signatures: update ADR-012 Approval rows + revision history

---

## Revision history

| Version | Date       | Notes                                                                     |
| ------- | ---------- | ------------------------------------------------------------------------- |
| 1.0     | 2026-07-15 | Initial packet index, emails, calendar copy for named countersigners      |
| 1.1     | 2026-07-15 | Outbox production copies + ICS + ADR name columns; send still human-gated |
