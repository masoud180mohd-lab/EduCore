# Database Freeze — Notifications / SMS (DBF-013)

| Field     | Value                                      |
| --------- | ------------------------------------------ |
| Freeze ID | `DBF-013`                                  |
| Version   | `1.0`                                      |
| Date      | 2026-08-03                                 |
| Companion | ACF-014                                    |
| Program   | **EPIC-COMMS-01** (COMMS-F0)               |
| Catalog   | `docs/engineering/communication/SMS_TEMPLATE_CATALOG.md` |
| Provider  | COMMS-001 — Beem (`beem`); Fake CI default |
| Authority | Solo-operator provisional (SOLO-GOV-001)   |

**Honesty:** Provisional. Implements Communication BC tables needed for SMS MVP + minimal transactional outbox (ADR-008). WhatsApp / email / preferences UI deferred.

## Scope (v1)

| In scope | Out of scope |
| -------- | ------------ |
| Templates (seeded catalog codes) | Free-form school template editor |
| Notification requests + idempotency | Marketing blast lists |
| Delivery attempts + provider ids | WhatsApp / email / push tables |
| Daily usage meter per tenant | Full inbox/DLQ product UI |
| Minimal `outbox_events` for send jobs | Multi-region outbox |

## RLS

- Pattern A: all tenant tables have `tenant_id`; policies require active membership.
- `educore_app`: SELECT on tables; writes via **SECURITY DEFINER** helpers only (same as finance).

## Tables (v1)

### `notification_templates`

| Column | Type | Notes |
| ------ | ---- | ----- |
| id | uuid PK | |
| tenant_id | uuid NULL | NULL = **system** template (shared); non-null = tenant override (later) |
| code | text | e.g. `fee_invoice_issued`, `comms_test_sms` |
| channel | text | `sms` only in v1 |
| locale | text | `en` \| `sw` |
| version | int | ≥ 1; unique with (tenant_id, code, channel, locale, version) treating NULL tenant as system |
| body | text | placeholders `{{token}}` only |
| status | text | `active` \| `retired` |
| created_at | timestamptz | |

CHECK: `channel = 'sms'`; `locale IN ('en','sw')`; body length ≤ 640 (allow multi-segment; prefer ≤160).

### `notification_requests`

| Column | Type | Notes |
| ------ | ---- | ----- |
| id | uuid PK | |
| tenant_id | uuid FK | RLS |
| template_code | text | |
| template_version | int | resolved at create |
| locale | text | `en` \| `sw` |
| channel | text | `sms` |
| recipient_type | text | `guardian` (v1) |
| recipient_id | uuid | guardian id in tenant |
| payload_json | jsonb | allowlisted placeholder values only |
| status | text | `accepted` \| `queued` \| `sending` \| `succeeded` \| `failed` \| `skipped` |
| skip_reason | text NULL | e.g. `no_phone`, `opt_out`, `daily_cap` |
| idempotency_key | text | required for create path |
| created_by_user_id | uuid | actor |
| created_at | timestamptz | |
| updated_at | timestamptz | |

UNIQUE `(tenant_id, idempotency_key)`.

### `notification_deliveries`

| Column | Type | Notes |
| ------ | ---- | ----- |
| id | uuid PK | |
| tenant_id | uuid FK | RLS |
| request_id | uuid FK | → notification_requests |
| provider_code | text | `fake` \| `beem` |
| provider_message_id | text NULL | opaque vendor id |
| phone_last4 | text NULL | never store full MSISDN in this table if avoidable — store **normalized hash or last4**; full E.164 only in encrypted/restricted column if required for resend (**v1: last4 + optional `phone_e164_ciphertext` deferred — use last4 + request join for support**) |
| status | text | `queued` \| `submitted` \| `sent` \| `delivered` \| `failed` |
| segment_count | int NULL | optional; default 1 |
| error_code | text NULL | |
| error_message | text NULL | sanitized; no full PII dumps |
| created_at | timestamptz | |
| updated_at | timestamptz | |

UNIQUE `(tenant_id, provider_code, provider_message_id)` WHERE provider_message_id IS NOT NULL.

**v1 phone storage honesty:** Store `dest_e164` on delivery row as text for Fake/Beem send retry **only if** column is SELECT-restricted via helpers; API allowlist exposes **last4** only. Prefer `dest_e164` internal + `phone_last4` for lists.

### `notification_usage_daily`

| Column | Type | Notes |
| ------ | ---- | ----- |
| tenant_id | uuid | |
| usage_date | date | UTC date of accepted send |
| channel | text | `sms` |
| sent_count | int | ≥ 0 |
| segment_count | int | ≥ 0 |
| PRIMARY KEY | (tenant_id, usage_date, channel) | |

Incremented in same transaction as successful provider submit (including Fake).

### `outbox_events` (minimal ADR-008)

| Column | Type | Notes |
| ------ | ---- | ----- |
| id | uuid PK | |
| tenant_id | uuid FK | RLS |
| event_type | text | e.g. `notification.send_requested` |
| aggregate_type | text | `notification_request` |
| aggregate_id | uuid | |
| payload_json | jsonb | minimal ids only — no full SMS body+phone |
| status | text | `pending` \| `processed` \| `failed` |
| attempts | int | |
| available_at | timestamptz | |
| processed_at | timestamptz NULL | |
| last_error | text NULL | |
| created_at | timestamptz | |

Worker claims `pending` rows; handlers idempotent.

## Helpers (SECURITY DEFINER — names locked)

| Helper | Purpose |
| ------ | ------- |
| `app.create_notification_request(...)` | Validate template + payload allowlist; skip if no phone; insert request; insert outbox; respect daily cap |
| `app.record_notification_delivery(...)` | Insert/update delivery; bump usage_daily on submit success |
| `app.claim_outbox_batch(...)` | Claim pending outbox for worker |

Exact signatures finalized in migration; membership checks mandatory.

## Permissions

| Code | Grant (system roles) |
| ---- | -------------------- |
| `notification.read` | owner, admin, staff |
| `notification.manage` | owner, admin, staff |

Seed in same migration as tables; add to `PERMISSION_CODES` + rbac reconcile.

## Non-goals

- `communication_preferences` / consent tables (v1: skip send if phone null)
- WhatsApp provider columns
- Tenant-authored template CRUD (seed system templates only)

## Solo-operator honesty

Provisional for EPIC-COMMS lab. Revisit phone-at-rest encryption before public pilot.
