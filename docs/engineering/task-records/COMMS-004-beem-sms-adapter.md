# COMMS-004 — Beem SMS adapter (env-gated)

| Field     | Value                                    |
| --------- | ---------------------------------------- |
| Program   | **COMMS-004** / EPIC-COMMS-01            |
| Date      | 2026-08-03                               |
| Status    | **Done** (solo-operator)                 |
| Depends   | COMMS-001 Accepted · COMMS-003           |
| Authority | Solo-operator provisional (SOLO-GOV-001) |

## Delivered

- `BeemSmsProvider` + `BeemHttpClient` (Basic auth → `POST {BEEM_BASE_URL}/v1/send`)
- Nest binds Beem only when `SMS_PROVIDER=beem` **and** `BEEM_API_KEY` + `BEEM_SECRET_KEY` + `BEEM_SOURCE_ADDR` present (else Fake)
- DLR webhook: `POST /api/v1/notifications/webhooks/beem` + header `X-Beem-Webhook-Secret`
  - Requires `BEEM_WEBHOOK_SECRET` (else **501**)
  - Body: `request_id` (Beem) + `status` (`DELIVERED` / `UNDELIVERED` / `FAILED` / `PENDING` / …)
  - Helper `app.apply_beem_delivery_report` (SECURITY DEFINER)
- `npm run sms:check-config` — redacted readiness report
- `.env.example` placeholders for `BEEM_BASE_URL` / `BEEM_WEBHOOK_SECRET`

## DLR contract (locked)

| Item            | Choice                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------- |
| Auth            | Shared secret header `X-Beem-Webhook-Secret` (Beem push may use portal callback URL + our secret) |
| Match key       | Beem `request_id` stored as `provider_message_id` on send ack                                     |
| Interim honesty | HTTP 2xx send ack → delivery `sent`; DLR optional for `delivered`                                 |
| Pull DLR        | Beem `dlrapi` poll deferred (COMMS-005 harden if needed)                                          |

## Non-goals this slice

- Live Beem sandbox pilot (operator keys)
- Africa’s Talking adapter
- Automatic payment/attendance domain triggers
- Admin UI

## Next

**COMMS-005** — harden meter / list evidence + manual QA.
