# B-07 / OPS-001 — Pilot ops minimum task record

| Field     | Value |
| --------- | ----- |
| Program   | **B-07** readiness blocker |
| Date      | 2026-08-08 |
| Status    | **Done** (ops stub / schedule — solo-operator provisional) |
| Decision  | `docs/engineering/decisions/B-07-pilot-slos-restore-drill-schedule.md` (**Accepted**) |
| Authority | Solo-operator provisional (SOLO-GOV-001) |
| Depends   | B-05 topology · B-04 lite threat model |

## Delivered

- Five pilot SLOs (login, availability, p95, 5xx, PITR verifiability)
- Alert thresholds + solo-operator on-call honesty
- Restore-drill schedule D1–D3 + weekly PITR glance (first D1 due 2026-09-15 or 30d after staging Neon)

## Explicitly not done

- Executed restore-drill evidence
- Live staging provision on Fly/Neon/Doppler
- Multi-person on-call
- Production GO

## Next

Operator: provision B-05 staging → run D1 → record `B-07-restore-drill-YYYY-MM-DD.md`. Kit residuals: B-03 DSF posture, IdP, PAY-OPS when keys.
