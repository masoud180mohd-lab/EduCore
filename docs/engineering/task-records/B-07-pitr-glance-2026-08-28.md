# B-07 weekly PITR glance — 2026-08-28

| Field | Value |
| --- | --- |
| Checked (UTC) | 2026-08-28T20:30:46.795Z |
| Owner | Project Owner / solo-operator (SOLO-GOV-001) |
| Signal | Neon `history_retention_seconds` + project list (SLO-5) |

## Projects

| Name | Region | PG | Retention | Extend |
| --- | --- | --- | --- | --- |
| educore-prod | aws-eu-central-1 | 16 | 6h (21600s) | unchanged |
| educore-staging-fra | aws-eu-central-1 | 16 | 6h (21600s) | unchanged |
| educore-staging | aws-us-east-2 | 18 | 6h (21600s) | unchanged |

## Honesty

- RPO ≤ 24h (B-05) is **data-loss window**, not how far back PITR can reach.
- Short `history_retention_seconds` (e.g. 6h on free/launch) means restore older than that window is **not** possible.
- This glance is **not** a restore drill (see D1/D2 evidence files).
- Project ids are operational identifiers, not secrets; connection URIs are omitted.
