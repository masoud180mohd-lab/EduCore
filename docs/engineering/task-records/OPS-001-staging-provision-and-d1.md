# OPS-001 — Staging provision + D1 runbook task record

| Field     | Value                                                           |
| --------- | --------------------------------------------------------------- |
| Program   | Operator readiness (B-05 residual / B-07 prep)                  |
| Date      | 2026-08-08                                                      |
| Status    | **Done** (runbook published — execution pending)                |
| Artifact  | `docs/engineering/runbooks/OPS-001-staging-provision-and-d1.md` |
| Authority | Solo-operator provisional (SOLO-GOV-001)                        |

## Delivered

- Phased checklist: Doppler → Neon → Fly → migrate → D1 restore smoke
- Secret **names** only; Fake providers default for staging until PAY/COMMS/AI ops
- Evidence template path for `B-07-restore-drill-YYYY-MM-DD.md`

## Explicitly not done

- Live account creation
- Executed D1 evidence
- Live `fly deploy` (Dockerfile/Fly config now in-repo via FLY-DOCKER)

## Next

Owner: execute Phases A–E → `fly deploy -c infra/fly/educore-api.staging.toml` → `GO DRILL-D1` evidence file.
