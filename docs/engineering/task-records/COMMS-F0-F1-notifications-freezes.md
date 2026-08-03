# COMMS-F0 / F1 — Notifications freezes (DBF-013 + ACF-014)

| Field     | Value                                      |
| --------- | ------------------------------------------ |
| Program   | **COMMS-F0/F1** / EPIC-COMMS-01            |
| Date      | 2026-08-03                                 |
| Status    | **Done** (solo-operator provisional)       |
| Depends   | COMMS-001 Accepted · COMMS-002 catalog     |
| Artifacts | `DBF-013-notifications-sms-slice.md` · `ACF-014-notifications-sms-slice.md` |
| Authority | Solo-operator provisional (SOLO-GOV-001)   |

## Delivered

- DBF-013: templates, requests, deliveries, usage_daily, minimal outbox_events; helpers named; RLS Pattern A
- ACF-014: templates list, create request (+ Idempotency-Key), deliveries list, Beem webhook stub; `notification.read` / `notification.manage`
- Permissions to seed in migration with COMMS-003

## Next

**COMMS-003** — Nest notification request service + Fake SMS path against these freezes.
