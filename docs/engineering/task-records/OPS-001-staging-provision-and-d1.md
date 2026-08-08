# OPS-001 — Staging provision + D1 runbook task record

| Field     | Value |
| --------- | ----- |
| Program   | Operator readiness (B-05 residual / B-07 prep) |
| Date      | 2026-08-08 |
| Status    | **Done** (runbook published — execution pending) |
| Artifact  | `docs/engineering/runbooks/OPS-001-staging-provision-and-d1.md` |
| Authority | Solo-operator provisional (SOLO-GOV-001) |

## Delivered

- Phased checklist: Doppler → Neon → Fly → migrate → D1 restore smoke  
- Secret **names** only; Fake providers default for staging until PAY/COMMS/AI ops  
- Evidence template path for `B-07-restore-drill-YYYY-MM-DD.md`

## Explicitly not done

- Live account creation  
- Dockerfile / Fly config IMP (called out as Phase D blocker if missing)  
- Executed D1 evidence  

## Next

Owner: execute Phases A–E → `GO DRILL-D1` evidence file.
