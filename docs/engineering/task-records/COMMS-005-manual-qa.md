# Manual QA — COMMS-005 Notifications / SMS ledger

Audience: staff with `notification.read` / `notification.manage`. Default provider = Fake (no Beem keys required).

Prereqs: migrations through `20260803120000_beem_delivery_report`; session + `X-Tenant-Id`.

## Happy path (Fake)

1. `GET /api/v1/notification-templates` → includes `comms_test_sms` (en/sw).
2. Ensure a guardian in tenant has a phone (e.g. `0712345678`).
3. `POST /api/v1/notifications/requests` with **Idempotency-Key** (UUID), body:
   `{ "templateCode": "comms_test_sms", "locale": "sw", "recipientType": "guardian", "recipientId": "<uuid>", "payload": { "school_name": "Shule" } }`
4. Expect request `status=succeeded` (Fake inline send).
5. `GET /api/v1/notifications/requests/{id}` → same status.
6. `GET /api/v1/notifications/deliveries?limit=10` → `{ data, page }`; item has `phoneLast4` only (no full MSISDN); `providerCode=fake`.
7. `GET /api/v1/notifications/usage` → `sentCount` ≥ 1 for today UTC; `dailyCap` present unless bypass set.
8. Replay same Idempotency-Key + body → same request; usage must **not** double-count.

## Filters

1. `GET .../deliveries?status=sent` → only sent rows.
2. `GET .../deliveries?requestId=<id>` → deliveries for that request.
3. Bad `status=bogus` → 400.

## Cap / bypass (lab)

1. Set `SMS_DAILY_CAP_PER_TENANT=0` (or 1 after one send) → next create may `skipped` / `daily_cap`.
2. Set `SMS_BYPASS_DAILY_CAP=true` → creates succeed again; `GET .../usage` shows `bypassDailyCap=true`, `dailyCap=null`.

## AuthZ / honesty

1. Without `notification.read` → 403 on templates/deliveries/usage.
2. Without `notification.manage` → 403 on POST requests.
3. Beem webhook without `BEEM_WEBHOOK_SECRET` → 501.
4. `npm run sms:check-config` → Fake effective when secrets absent (no secret values printed).

## Out of scope this QA

- Live Beem send (needs keys + Sender ID)
- Admin UI
- WhatsApp
