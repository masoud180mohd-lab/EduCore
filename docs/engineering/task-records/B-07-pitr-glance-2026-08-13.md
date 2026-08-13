# B-07 weekly PITR glance — 2026-08-13

| Field | Value |
| --- | --- |
| Checked (UTC) | 2026-08-13T10:58:45.330Z |
| Owner | Project Owner / solo-operator (SOLO-GOV-001) |
| Signal | Neon `history_retention_seconds` + project list (SLO-5) |

## Projects

| Name | Region | PG | Retention | Extend |
| --- | --- | --- | --- | --- |
| educore-prod | aws-eu-central-1 | 16 | 6h (21600s) | PATCH 7d rejected (plan max 6h) |
| educore-staging-fra | aws-eu-central-1 | 16 | 6h (21600s) | PATCH 7d rejected (plan max 6h) |
| educore-staging | aws-us-east-2 | 18 | 6h (21600s) | unchanged (legacy US; not FRA primary) |

## Honesty

- RPO ≤ 24h (B-05) is **data-loss window**, not how far back PITR can reach.
- Current Neon plan max `history_retention_seconds` is **6h**. Weekly restore older than 6h is **not** possible until the plan is upgraded.
- Cadence: re-run `npm run ops:pitr:glance` weekly (`doppler run --project educore --config stg`).
- This glance is **not** a restore drill (see D1/D2 evidence files).
- Project ids are operational identifiers, not secrets; connection URIs are omitted.
