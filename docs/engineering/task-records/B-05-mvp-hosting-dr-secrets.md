# B-05 / INFRA-001 — Hosting & DR decision task record

| Field     | Value |
| --------- | ----- |
| Program   | **B-05** readiness blocker |
| Date      | 2026-08-04 |
| Status    | **Done** (solo-operator provisional) |
| Decision  | `docs/engineering/decisions/B-05-mvp-hosting-dr-secrets.md` (**Accepted**) |
| Authority | Solo-operator provisional (SOLO-GOV-001) |

## Delivered

- Chosen topology: **Fly.io + Neon + Doppler**, region **Frankfurt / EU-central**
- MVP **RPO ≤ 24h**, **RTO ≤ 8h**; recovery owner = Project Owner / solo-operator
- Local/CI Docker Compose unchanged; Redis/object storage deferred

## Explicitly not done

- Live Fly/Neon/Doppler provisioning
- Restore drill evidence (belongs to **B-07**)
- Production GO

## Next

`GO B04-THREAT` or `GO B07`.
