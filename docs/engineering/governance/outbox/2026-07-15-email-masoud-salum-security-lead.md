# READY TO SEND — Masoud Salum (Security Lead)

| Field    | Value                                                                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status   | **READY TO COPY-PASTE** — AI cannot send mail; human must Send                                                                                          |
| Prepared | 2026-07-15 (send by **2026-07-16**)                                                                                                                     |
| From     | Principal Architect / Governance Lead                                                                                                                   |
| To       | **Masoud Salum** \<replace-with-real-email\>                                                                                                            |
| Cc       | PM Master; Rashid Mohammed                                                                                                                              |
| Attach   | `ADR-012_ONE_PAGE_SUMMARY.md` · `ADR-012_COUNTERSIGNATURE_PACKET.md` · `AUDIT-R2-live-evidence-2026-07-14.md` · `2026-08-13-adr-012-review-meeting.ics` |

---

## SUBJECT (copy)

```
ACTION REQUIRED by 2026-08-08 — Countersign ADR-012 (Security Lead) | EduCore Identity & Tenant
```

---

## BODY (copy everything below this line)

```
Dear Masoud,

I am writing in my capacity as Principal Architect / Governance Lead for EduCore to request your formal countersignature on ADR-012.

────────────────────────────────────────
1. Why you are receiving this
────────────────────────────────────────
The Independent Engineering Audit identified material process and tenancy risks:
schema and RLS work progressed before formal Freeze v1.0 human acceptance, and
prompt-only authorization is not valid freeze governance.

ADR-012 documents a time-bounded exception with explicit conditions, residual
risks, and expiry. Security Lead countersignature is required so residual RLS /
tenancy risk is explicitly owned — not assumed.

Your signature means you accept the exception’s security residual risk posture
for the provisional scaffolding layer. It does NOT mean product multi-tenant
traffic is production-ready, and it does NOT accept DBF-001 / ACF-001 as v1.0.

────────────────────────────────────────
2. What Security should verify
────────────────────────────────────────
Please confirm for yourself (and be ready to state at the review meeting):

  • Runtime pool remains educore_app with FORCE RLS; no superuser / migrator pool
  • INSERT trust boundary: educore_app cannot create tenants/users via GUC spoofing
  • Live isolation suite has been run against PostgreSQL (evidence on file)
  • Membership helpers are no longer a permanent false-stub
  • Nest Identity/Tenant product HTTP routes remain NO GO under this ADR alone

────────────────────────────────────────
3. Documents to review (priority order)
────────────────────────────────────────
Required:
  1) docs/engineering/governance/ADR-012_ONE_PAGE_SUMMARY.md
  2) docs/engineering/decisions/ADR-012-exception-identity-tenant-implementation.md
       → Risks, Mitigations, Conditions, Expiry
  3) docs/engineering/task-records/AUDIT-R2-live-evidence-2026-07-14.md
  4) docs/engineering/gates/FREEZE_ACCEPTANCE_IDENTITY_TENANT.md (residual risks)
  5) docs/engineering/governance/IDENTITY_TENANT_GOVERNANCE_ACTION_PLAN.md §4.2

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
      Then complete the Security row in ADR-012 Approval table:
      Name: Masoud Salum
      Date: YYYY-MM-DD
      Signature phrase: Countersigned — exception only; Freeze v1.0 still pending

  (B) CHANGES REQUESTED — list concrete security blockers

  (C) DELEGATE — name an alternate with Security Lead authority

Please accept the calendar invite. On 13 August we will reaffirm HTTP NO GO and
capture residual security actions through hard expiry.

Kind regards,

Principal Architect / Governance Lead
EduCore School Management System
```

---

## Operator notes (do not paste into email)

- Replace real email addresses before send.
- Strongly attach the live evidence PDF/export or ensure Masoud can open the path in the monorepo.
- After Send: tick `SEND_LOG.md`.
