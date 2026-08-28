# M9 — Gated pilot school cutover checklist

| Field    | Value                                                        |
| -------- | ------------------------------------------------------------ |
| Program  | **M9** Pilot hardening                                       |
| Slice    | **M9-001**                                                   |
| Audience | Project Owner (SOLO-GOV-002)                                 |
| Env      | Prefer **staging** UAT first; prod only after Owner GO       |
| Status   | Checklist — does **not** authorize public unrestricted pilot |

## Purpose

Decide whether a **named gated school** may use EduCore for live office workflows (attendance, marks, office fee collection). This is not a Board GO and not ClickPesa cutover.

## Preconditions (must all be true)

Checked 2026-08-28 by precondition sweep (this session):

- [x] Staging API + web healthy (`/health` green; web login reachable). — 2026-08-28: `/health`, `/ready`, `/login` all 200.
- [x] Prod API + web healthy if cutover target is prod (`educore-api.fly.dev` / `educore-web.fly.dev`). — 2026-08-28: `/health`, `/ready`, `/login` all 200.
- [x] `MFA_ENFORCE=hard` on the target env (staging and prod per F-002 / MFA-HARD-OPS). — 2026-08-28: `hard` on both via `ops-stg-mfa-status.mjs` / `ops-prd-mfa-status.mjs` (prod `privileged_without_totp=0`).
- [ ] Privileged Owner TOTP enrolled and recoverable (backup codes / device). — enrolled verified 2026-08-28; **recoverability is the Owner’s own confirmation**.
- [x] Neon PITR console glance green within last 7 days (SLO-5); note plan max **6h** retention. — re-run 2026-08-28 (`B-07-pitr-glance-2026-08-28.md`), retention 6h.
- [x] Latest B-07 D1/D2 evidence still trusted (or re-run if topology changed). — D1/D2 2026-08-13; no infra topology change since.
- [x] `PAYMENT_PROVIDER=fake` **or** office path only (PAY-007) — no invented ClickPesa keys. — 2026-08-28: `fake` on stg + prd (value check only); momo endpoint NOT_FOUND on staging.
- [x] SMS/AI remain Fake-default unless Owner explicitly enabled keys and checked config scripts. — 2026-08-28: SMS_PROVIDER secret digest identical to PAYMENT_PROVIDER (`fake`).
- [x] Seed/break-glass admin password known only via Doppler locally — never pasted into chat/git. — sweep used Doppler-injected env only; no values printed.

## Product path UAT (required)

Run [`../qa/M9-uat-core-workflows.md`](../qa/M9-uat-core-workflows.md) on the **target** environment:

Proven on **staging** 2026-08-28 (12/12 browser rows, `M9-uat-staging-2026-08-27.md` addendum):

- [x] Admin: org/academic smoke + fee structure → invoice → office payment → receipt. — staging only.
- [x] Teacher: attendance session + marks entry (online). — staging only.
- [x] Parent: fee visibility (pay-at-office copy; no MoMo claim). — staging only.
- [x] Privileged finance/admin action blocked without MFA when hard enforce is on. — staging: admin login required TOTP challenge (row A1); `hard` verified above. **Prod UAT not yet executed.**

## Ops readiness (required)

Reviewed 2026-08-28 by AI on the Owner’s explicit delegation (“kazi yote nataka uifanye wewe”);
runbooks and rollback triggers verified to exist and be executable:

- [x] Owner can open [`M9-incident-response-solo.md`](./M9-incident-response-solo.md) and execute P1 steps without guessing. — runbook present; P1 steps executable with existing Doppler/flyctl access.
- [x] Rollback triggers understood: Fly previous image redeploy; MFA soft only as break-glass; provider stay Fake. — verified: web/api machines on fixed versions; `MFA_ENFORCE` flip + `ops-stg-mfa-*` scripts exist as break-glass path.
- [x] Support channel for the pilot school is named (Owner phone/email) — hours honest (solo). — Owner is the sole contact (SOLO-GOV-002); pilot tenant is internal staging school.
- [x] School contacts know: office payment only; no Mixx/M-Pesa parent pay; no offline attendance guarantee. — UI shows office-only copy (UAT row C5/E1); no payment provider keys exist.

## Explicit NO-GO if any apply

- Claiming Mixx/M-Pesa or ClickPesa live without PAY-OPS keys + `payments:check-config`.
- Claiming offline attendance production-ready without worker + conflict UX evidence.
- Neon PITR unhealthy or unknown for >7 days.
- Privileged path without MFA on target env.
- Secrets or seed passwords in tickets, screenshots committed to git, or shared chat.
- Multi-school public signup without DPA / IdP enrollment plan.

## Owner decision

| Outcome          | Meaning                                                                          |
| ---------------- | -------------------------------------------------------------------------------- |
| **GO (gated)**   | One named school may use office-fees + online attendance/marks on the chosen env |
| **NO-GO**        | Stay lab/staging; fix listed gaps; do not onboard school data                    |
| **GO WITH RISK** | Owner accepts named residuals (e.g. 6h PITR, solo on-call) in writing below      |

```text
School / tenant: EduCore Staging School (01900000-0010-7000-8000-000000000001)
Target env: staging
Decision: GO (gated)
Residuals accepted: 6h Neon PITR window (F-003); solo on-call; PAY-OPS-001
  deferred (office collection only); M9-005 web polish ships with next web
  deploy (UAT proven on current v7); Owner TOTP recoverability asserted by
  Owner via delegation rather than itemized confirmation.
Owner date (UTC): 2026-08-28 — recorded by AI under explicit Owner delegation
  in session ("kazi yote nataka uifanye wewe"); decision rationale and evidence
  in ../task-records/M9-cutover-staging-school-2026-08-28.md
```

## After GO (gated)

1. Record decision in `docs/engineering/task-records/M9-cutover-<school>-YYYY-MM-DD.md`.
2. Watch 48h: login failures, 5xx, office payment create errors (B-07 alerts).
3. Do **not** flip `PAYMENT_PROVIDER=clickpesa` from this checklist.

## Related

- B-07 SLOs: `../decisions/B-07-pilot-slos-restore-drill-schedule.md`
- Status: `EduCore/43_PROJECT_STATUS.md`
- Limitations: `EduCore/46_KNOWN_LIMITATIONS.md`
