# OPS-EXEC — status update after D1

| Field     | Value |
| --------- | ----- |
| Date      | 2026-08-08 / 2026-08-09 |
| Status    | **Staging live + D1 Pass** (solo-operator) |
| Prior     | `OPS-EXEC-2026-08-08.md` (was blocked on CLIs) |

## Done

- Phase 0 tooling + Fly/Doppler login  
- Neon `educore-staging`, Doppler `educore`/`stg`, Fly `educore-api-staging`  
- Bootstrap roles + migrate + runtime secrets + Fly deploy  
- `/health` OK; admin seed + login smoke  
- **D1** Pass — `B-07-restore-drill-2026-08-08.md` (RTO ~6s)

## Still open

- Rotate `educore_app` (and any chat-exposed) passwords  
- Confirm Neon region vs B-05 Frankfurt preference (current project may be us-east-2)  
- Production GO still **NO**
