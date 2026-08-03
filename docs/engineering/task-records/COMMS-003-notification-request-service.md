# COMMS-003 — Notification request service (Fake SMS)

| Field     | Value                                    |
| --------- | ---------------------------------------- |
| Program   | **COMMS-003** / EPIC-COMMS-01            |
| Date      | 2026-08-03                               |
| Status    | **Done** (solo-operator)                 |
| Depends   | COMMS-001/002 · DBF-013 · ACF-014        |
| Authority | Solo-operator provisional (SOLO-GOV-001) |

## Delivered

- Migration `20260803100000_notifications_sms_create` — tables, seed templates, permissions, helpers
- `SMS_PROVIDER_PORT` + `FakeSmsProvider` (default)
- HTTP: GET templates, POST requests (+ Idempotency-Key), GET request, GET deliveries
- Inline Fake send after queue (outbox row marked processed); usage_daily increment
- Template allowlist render; TZ MSISDN normalize; phone last4 on deliveries
- `.env.example` SMS placeholders; `notification.*` in permission catalogue + staff grants

## Non-goals this slice

- Beem HTTP client (COMMS-004)
- Admin UI
- Automatic payment/attendance domain triggers

## Next

**COMMS-004** — Beem adapter behind env secrets.
