# READY TO SEND — Rashid Mohammed (Backend Lead)

| Field             | Value                                                                              |
| ----------------- | ---------------------------------------------------------------------------------- |
| **Status**        | **READY TO COPY-PASTE** — human must click Send                                    |
| **Prepared**      | 2026-07-15 · refresh for final send                                                |
| **Send by**       | **As soon as possible** (target same day / next business day)                      |
| **From**          | Principal Architect / Governance Lead                                              |
| **To**            | Rashid Mohammed \<rashid.mohammed@educore.local\>                                  |
| **Cc**            | PM Master \<pm.master@educore.local\>; Masoud Salum \<masoud.salum@educore.local\> |
| **Attach / link** | See list below                                                                     |

---

## SUBJECT (copy entire line)

```
ACTION REQUIRED by 2026-08-08 — Countersign ADR-012 (Backend Lead) | EduCore Identity & Tenant
```

---

## BODY (copy everything inside the fence — do not include the fence)

```
Dear Rashid,

I am writing as Principal Architect / Governance Lead for EduCore to request your
formal countersignature on ADR-012 (Identity & Tenant architecture exception).

────────────────────────────────────────
1. Why we need your signature
────────────────────────────────────────
ADR-012 authorizes a limited, time-bounded exception for Identity & Tenant work
under Conditional Freeze. Day-to-day enforcement lives in PR reviews and
implementation sequencing. Without Backend Lead ownership, delivery pressure can
quietly expand product HTTP surface before Freeze v1.0 is real.

Your countersignature means you will enforce the exception’s Conditions in
engineering practice. It does NOT authorize unrestricted product APIs, and it
does NOT accept ACF-001 as Freeze v1.0.

────────────────────────────────────────
2. Engineering snapshot & Backend ownership
────────────────────────────────────────
Intentional under the exception (platform / scaffolding):
  • Nest modular skeleton, quality gate, module boundaries
  • AuthN routes under /api/v1/auth/* (login, refresh, logout, me, select-tenant)
  • RBAC foundation (roles seed path, PolicyEvaluator, RequirePermission)

Still NO GO under ADR-012 alone (enforce in reviews):
  • Tenant / user admin CRUD and membership invite admin APIs
  • Role-admin HTTP and other domain product APIs (Student, Finance, …)
  • Runtime pool other than educore_app for Nest
  • Claiming Freeze v1.0 without human signatures

Please also continue to require:
  • npm run check + boundaries:check on related changes
  • Material schema/API design changes reflected in DBF-001 / ACF-001 drafts first

────────────────────────────────────────
3. Documents to review (≈ 30–40 minutes)
────────────────────────────────────────
Required:
  1) docs/engineering/governance/ADR-012_ONE_PAGE_SUMMARY.md
       → Out of scope / Forbidden
  2) docs/engineering/decisions/ADR-012-exception-identity-tenant-implementation.md
       → Conditions of the Exception, Approval block
  3) docs/engineering/governance/IDENTITY_TENANT_GOVERNANCE_COMPLETION_PLAN.md §7.3
  4) docs/engineering/governance/IDENTITY_TENANT_GOVERNANCE_ACTION_PLAN.md §4.3
  5) docs/engineering/gates/FREEZE_ACCEPTANCE_IDENTITY_TENANT.md
       → Allowed vs Forbidden work

Awareness only (not signing Freeze v1.0 in this step):
  6) docs/engineering/api-contract-freeze/ACF-001-identity-tenant-slice.md

Packet index:
  docs/engineering/governance/ADR-012_COUNTERSIGNATURE_PACKET.md

────────────────────────────────────────
4. Deadlines
────────────────────────────────────────
  • Countersign / reply deadline:  Friday  2026-08-08 (end of day)
  • ADR-012 review meeting:        Thursday 2026-08-13, 10:00–11:15 EAT
  • Binding ADR review-by date:    2026-08-15
  • Exception hard expiry:         2026-09-15 (unless freezes complete or renewed)

────────────────────────────────────────
5. Please reply by 2026-08-08 with ONE of
────────────────────────────────────────
  (A) APPROVE
      Then complete the Backend Lead row in the ADR-012 Approval table:
        Name: Rashid Mohammed
        Date: YYYY-MM-DD
        Phrase: Countersigned — exception only; Freeze v1.0 still pending

  (B) CHANGES REQUESTED — list concrete process / scope blockers

  (C) DELEGATE — name an alternate with Backend Lead authority

────────────────────────────────────────
6. Meeting request
────────────────────────────────────────
Please accept the calendar invite for:

  Thursday 13 August 2026, 10:00–11:15 EAT
  EduCore — ADR-012 Exception Review (Identity & Tenant)
  Video: see calendar LOCATION (or “Video link TBD” until host finalizes)

At the meeting we will reaffirm product-route discipline and the path to
ACF-001 / DBF-001 Freeze v1.0 before hard expiry.

Thank you for holding engineering discipline under Conditional Freeze.

Kind regards,

Principal Architect / Governance Lead
EduCore School Management System
```

---

## Headers for your mail client (copy)

| Header      | Value                                               |
| ----------- | --------------------------------------------------- |
| **To**      | rashid.mohammed@educore.local                       |
| **Cc**      | pm.master@educore.local; masoud.salum@educore.local |
| **Subject** | (see SUBJECT block above)                           |

## Attachments (recommended)

1. `docs/engineering/governance/ADR-012_ONE_PAGE_SUMMARY.md`
2. `docs/engineering/governance/ADR-012_COUNTERSIGNATURE_PACKET.md`
3. `docs/engineering/governance/outbox/2026-08-13-adr-012-review-meeting.ics`
4. Optional: `docs/engineering/governance/IDENTITY_TENANT_GOVERNANCE_COMPLETION_PLAN.md`

---

## Operator notes (do not paste into email)

- After Send: tick the Rashid Mohammed row in `SEND_LOG.md`.
- Optionally BCC yourself for archive.
