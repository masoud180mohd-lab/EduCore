# M9 — Solo-operator incident response (pilot)

| Field     | Value                                                |
| --------- | ---------------------------------------------------- |
| Program   | **M9** Pilot hardening                               |
| Slice     | **M9-001**                                           |
| Authority | SOLO-GOV-002 (Owner + AI)                            |
| Aligns    | B-07 alert thresholds                                |
| Honesty   | Single-person on-call; no secondary escalation named |

## Severity

| Sev    | Meaning                          | Response target (solo)                              |
| ------ | -------------------------------- | --------------------------------------------------- |
| **P1** | Outage or data/secret risk       | Acknowledge within 15 min when awake; mitigate ASAP |
| **P2** | Degraded auth or elevated errors | Same day                                            |
| **P3** | Non-urgent hygiene               | Next working session                                |

## Alert → action map

### API down (health fail > 5 min) — P1

1. Confirm: `GET https://educore-api-staging.fly.dev/health` and/or prod `https://educore-api.fly.dev/health`.
2. Fly status: `flyctl status -a educore-api-staging` (or `educore-api`).
3. Neon console: project reachable? Connection limits?
4. Mitigate: redeploy last known-good image (`flyctl releases` → prior deploy) **or** scale/restart machines.
5. If DB unreachable: pause school writes; do not invent connection strings in chat.
6. Log: task-record `M9-incident-YYYY-MM-DD.md` with start/end UTC and RTO.

### Error spike (5xx > 5% for 15 min) — P1

1. Sample recent Fly logs / structured error codes (no tokens/PII in paste).
2. If related to payment/SMS/AI provider: force Fake via Doppler + Fly sync; verify `*:check-config` where applicable.
3. If bad deploy: rollback Fly release.
4. If migration-related: stop further deploys; restore path is B-07 D1 (Neon branch) — do not claim drill if not run.

### Login failure spike (> 20% for 15 min) — P2

1. Distinguish client misuse (wrong password) vs `MFA_REQUIRED` / IdP / 5xx.
2. Check `MFA_ENFORCE` and TOTP encryption key presence in Doppler (do not print secrets).
3. Break-glass only: `MFA_ENFORCE=soft` + Fly sync — temporary; re-harden after.
4. Password spray suspicion: rotate seed admin via Doppler + `SEED_ADMIN_RESET=1` seed path on that env; revoke sessions if tooling exists.

### Backup / PITR unhealthy — P1

1. Neon console: backups/PITR status.
2. Pause non-essential writes if restore window is compromised.
3. Open Neon support if vendor-side; note **6h** plan max residual.
4. Do not claim RPO ≤ 24h if PITR window is shorter than needed for the incident.

### Suspected secret leak — P1

1. Rotate leaked credential in Doppler immediately.
2. Sync Fly secrets for affected app.
3. Revoke sessions / rotate `SEED_ADMIN_PASS` if admin credential exposed.
4. Never commit rotated values; never paste into chat.

## Communication (gated school)

- Tell school contact: impact, workaround (e.g. record fees on paper until office path green), next update time.
- Do **not** promise MoMo, offline sync, or Board-certified uptime.
- After resolve: one short note of cause + prevention (task-record).

## Rollback cheatsheet

| Layer     | Action                                                  |
| --------- | ------------------------------------------------------- |
| App       | `flyctl releases -a <app>` → redeploy prior image       |
| MFA       | Doppler `MFA_ENFORCE=soft` then sync Fly (break-glass)  |
| Providers | Keep/set Fake; never invent ClickPesa/Beem/OpenAI keys  |
| DB        | Neon PITR / branch restore per B-07 D1 evidence pattern |

## Non-goals

- PagerDuty / multi-person rota
- Public status page
- Claiming drills you did not run

## Related

- Cutover: [`M9-pilot-cutover-checklist.md`](./M9-pilot-cutover-checklist.md)
- B-07: `../decisions/B-07-pilot-slos-restore-drill-schedule.md`
- Staging provision: [`OPS-001-staging-provision-and-d1.md`](./OPS-001-staging-provision-and-d1.md)
