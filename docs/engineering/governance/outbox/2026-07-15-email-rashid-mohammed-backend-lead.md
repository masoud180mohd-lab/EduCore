# READY TO SEND — Rashid Mohammed (Backend Lead)

| Field    | Value                                                                                                          |
| -------- | -------------------------------------------------------------------------------------------------------------- |
| Status   | **READY TO COPY-PASTE** — AI cannot send mail; human must Send                                                 |
| Prepared | 2026-07-15 (send by **2026-07-16**)                                                                            |
| From     | Principal Architect / Governance Lead                                                                          |
| To       | **Rashid Mohammed** \<replace-with-real-email\>                                                                |
| Cc       | PM Master; Masoud Salum                                                                                        |
| Attach   | `ADR-012_ONE_PAGE_SUMMARY.md` · `ADR-012_COUNTERSIGNATURE_PACKET.md` · `2026-08-13-adr-012-review-meeting.ics` |

---

## SUBJECT (copy)

```
ACTION REQUIRED by 2026-08-08 — Countersign ADR-012 (Backend Lead) | EduCore Identity & Tenant
```

---

## BODY (copy everything below this line)

```
Dear Rashid,

I am writing in my capacity as Principal Architect / Governance Lead for EduCore to request your formal countersignature on ADR-012.

────────────────────────────────────────
1. Why you are receiving this
────────────────────────────────────────
ADR-012 authorizes a limited, time-bounded exception for Identity & Tenant
persistence scaffolding under Conditional Freeze. It deliberately keeps NestJS
product HTTP routes closed.

Backend Lead countersignature is required because day-to-day enforcement lives
in PR reviews and implementation sequencing. Without Backend ownership, “demo
pressure” can quietly open login/CRUD routes before Freeze v1.0 is real.

Your signature means you will enforce the exception’s Conditions in engineering
practice. It does NOT authorize product APIs, and it does NOT accept ACF-001 as
Freeze v1.0.

────────────────────────────────────────
2. What Backend must own under this exception
────────────────────────────────────────
  • No Identity/Tenant domain controllers or public business routes under
    ADR-012 alone (login, tenant CRUD, membership invite, RBAC admin, etc.)
  • Runtime DB pool = educore_app only (never migrator / platform / superuser)
  • Material schema/API design changes go into DBF-001 / ACF-001 drafts first
  • PR checklist for Identity/Tenant remains mandatory
  • npm run check + boundaries:check stay green on related changes

────────────────────────────────────────
3. Documents to review (priority order)
────────────────────────────────────────
Required:
  1) docs/engineering/governance/ADR-012_ONE_PAGE_SUMMARY.md
       → especially Out of scope / Forbidden
  2) docs/engineering/decisions/ADR-012-exception-identity-tenant-implementation.md
       → Conditions of the Exception
  3) docs/engineering/governance/IDENTITY_TENANT_GOVERNANCE_ACTION_PLAN.md §4.3
  4) docs/engineering/gates/FREEZE_ACCEPTANCE_IDENTITY_TENANT.md
       → Allowed vs Forbidden work
  5) Skim: docs/engineering/api-contract-freeze/ACF-001-identity-tenant-slice.md
       → design context only; not signing Freeze v1.0 in this step

Full packet index:
  docs/engineering/governance/ADR-012_COUNTERSIGNATURE_PACKET.md

────────────────────────────────────────
4. Deadlines
────────────────────────────────────────
  • Countersign / reply deadline:  Friday  2026-08-08
  • ADR-012 review meeting:        Thursday 2026-08-13, 10:00–11:15 EAT
  • Binding ADR review-by date:    2026-08-15
  • ADR hard expiry:               2026-09-15 (unless renewed or freezes completed)

────────────────────────────────────────
5. How to respond
────────────────────────────────────────
Please reply by 2026-08-08 with ONE of:

  (A) APPROVE
      Then complete the Backend Lead row in ADR-012 Approval table:
      Name: Rashid Mohammed
      Date: YYYY-MM-DD
      Signature phrase: Countersigned — exception only; Freeze v1.0 still pending

  (B) CHANGES REQUESTED — list concrete process / scope blockers

  (C) DELEGATE — name an alternate with Backend Lead authority

Please accept the calendar invite. At the 13 August meeting we will reaffirm
HTTP NO GO and agree the path to Freeze v1.0 before hard expiry.

Kind regards,

Principal Architect / Governance Lead
EduCore School Management System
```

---

## Operator notes (do not paste into email)

- Replace real email addresses before send.
- Optionally BCC yourself for archive.
- After Send: tick `SEND_LOG.md`.
