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

- [ ] Staging API + web healthy (`/health` green; web login reachable).
- [ ] Prod API + web healthy if cutover target is prod (`educore-api.fly.dev` / `educore-web.fly.dev`).
- [ ] `MFA_ENFORCE=hard` on the target env (staging and prod per F-002 / MFA-HARD-OPS).
- [ ] Privileged Owner TOTP enrolled and recoverable (backup codes / device).
- [ ] Neon PITR console glance green within last 7 days (SLO-5); note plan max **6h** retention.
- [ ] Latest B-07 D1/D2 evidence still trusted (or re-run if topology changed).
- [ ] `PAYMENT_PROVIDER=fake` **or** office path only (PAY-007) — no invented ClickPesa keys.
- [ ] SMS/AI remain Fake-default unless Owner explicitly enabled keys and checked config scripts.
- [ ] Seed/break-glass admin password known only via Doppler locally — never pasted into chat/git.

## Product path UAT (required)

Run [`../qa/M9-uat-core-workflows.md`](../qa/M9-uat-core-workflows.md) on the **target** environment:

- [ ] Admin: org/academic smoke + fee structure → invoice → office payment → receipt.
- [ ] Teacher: attendance session + marks entry (online).
- [ ] Parent: fee visibility (pay-at-office copy; no MoMo claim).
- [ ] Privileged finance/admin action blocked without MFA when hard enforce is on.

## Ops readiness (required)

- [ ] Owner can open [`M9-incident-response-solo.md`](./M9-incident-response-solo.md) and execute P1 steps without guessing.
- [ ] Rollback triggers understood: Fly previous image redeploy; MFA soft only as break-glass; provider stay Fake.
- [ ] Support channel for the pilot school is named (Owner phone/email) — hours honest (solo).
- [ ] School contacts know: office payment only; no Mixx/M-Pesa parent pay; no offline attendance guarantee.

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
School / tenant: ____________________
Target env: staging | prod
Decision: GO (gated) | NO-GO | GO WITH RISK
Residuals accepted: ____________________
Owner date (UTC): ____________________
```

## After GO (gated)

1. Record decision in `docs/engineering/task-records/M9-cutover-<school>-YYYY-MM-DD.md`.
2. Watch 48h: login failures, 5xx, office payment create errors (B-07 alerts).
3. Do **not** flip `PAYMENT_PROVIDER=clickpesa` from this checklist.

## Related

- B-07 SLOs: `../decisions/B-07-pilot-slos-restore-drill-schedule.md`
- Status: `EduCore/43_PROJECT_STATUS.md`
- Limitations: `EduCore/46_KNOWN_LIMITATIONS.md`
