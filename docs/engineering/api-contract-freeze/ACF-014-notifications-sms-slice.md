# API Contract Freeze — Notifications / SMS (ACF-014)

| Field     | Value                                                    |
| --------- | -------------------------------------------------------- |
| Freeze ID | `ACF-014`                                                |
| Version   | `1.0`                                                    |
| Date      | 2026-08-03                                               |
| Companion | DBF-013                                                  |
| Program   | **EPIC-COMMS-01** (COMMS-F1)                             |
| Catalog   | `docs/engineering/communication/SMS_TEMPLATE_CATALOG.md` |
| Provider  | COMMS-001 — Beem; Fake CI default                        |
| Authority | Solo-operator provisional (SOLO-GOV-001)                 |

**Honesty:** Provisional. Product HTTP for SMS notify MVP. No WhatsApp. No parent SMS inbox UI.

## Scope (v1)

| In scope                                    | Out of scope                              |
| ------------------------------------------- | ----------------------------------------- |
| List active templates                       | Template editor UI                        |
| Create notification request (manual/admin)  | Bulk blast campaigns                      |
| List deliveries (cursor)                    | Parent-facing SMS history                 |
| Get request by id                           | Automatic domain event wiring (follow-on) |
| Optional Beem DLR webhook (later COMMS-004) | Email / push                              |

## Auth stack

Authenticated → Tenant header → Session tenant bind → Permission → RLS.

## Permissions

| Code                  | Use                                      |
| --------------------- | ---------------------------------------- |
| `notification.read`   | GET templates, requests, deliveries      |
| `notification.manage` | POST notification request (send/enqueue) |

## Endpoints

| Method | Path                                         | AuthZ                                                                                 |
| ------ | -------------------------------------------- | ------------------------------------------------------------------------------------- |
| GET    | `/api/v1/notification-templates`             | notification.read                                                                     |
| GET    | `/api/v1/notifications/requests/{requestId}` | notification.read                                                                     |
| POST   | `/api/v1/notifications/requests`             | notification.manage + **Idempotency-Key**                                             |
| GET    | `/api/v1/notifications/deliveries`           | notification.read — cursor pagination                                                 |
| POST   | `/api/v1/notifications/webhooks/beem`        | **No session**; shared-secret / signed check (COMMS-004) — stub may 501 until adapter |

### POST `/api/v1/notifications/requests`

Body allowlist:

| Field         | Type         | Notes                                    |
| ------------- | ------------ | ---------------------------------------- |
| templateCode  | string       | catalog code                             |
| locale        | `en` \| `sw` | default `sw` or tenant locale later      |
| recipientType | `guardian`   | v1 only                                  |
| recipientId   | uuid         | guardian in tenant                       |
| payload       | object       | keys ⊆ template allowlist; string values |

Behavior:

1. Resolve active template version.
2. Reject unknown payload keys (400).
3. If guardian has no phone → request `skipped` / `no_phone` (200 with status, **or** 409 — prefer **200** with `data.status=skipped` so idempotent clients settle).
4. Else create request + outbox; return request resource.
5. Same Idempotency-Key + body hash → replay.

Fake/Beem: worker or inline lab path submits via `SMS_PROVIDER_PORT`; delivery row required before/at submit.

### GET `/api/v1/notifications/deliveries`

Query: `limit`, `cursor`, optional `requestId`, optional `status`.

Response items expose **phoneLast4** only (never full MSISDN).

### GET `/api/v1/notification-templates`

Returns active system (+ tenant) templates: `code`, `channel`, `locale`, `version`, `body` (for admin preview), `status`.

## Resource allowlists

**NotificationTemplate:** id, code, channel, locale, version, body, status, createdAt

**NotificationRequest:** id, tenantId, templateCode, templateVersion, locale, channel, recipientType, recipientId, payload, status, skipReason, createdAt, updatedAt

**NotificationDelivery:** id, tenantId, requestId, providerCode, providerMessageId, phoneLast4, status, segmentCount, errorCode, createdAt, updatedAt

## Errors

| HTTP | When                                                              |
| ---- | ----------------------------------------------------------------- |
| 400  | validation / unknown placeholder / bad locale                     |
| 401  | unauthenticated                                                   |
| 403  | missing notification.*                                            |
| 404  | unknown request/guardian (no cross-tenant leak)                   |
| 409  | idempotency body mismatch; daily cap exceeded (optional explicit) |
| 501  | Beem path without secrets / webhook not configured                |

## Idempotency & cost

- Create request: Idempotency-Key **required**.
- Same key must **not** double-increment usage or double-submit provider.
- Daily cap: config `SMS_DAILY_CAP_PER_TENANT` (Fake still records deliveries; may bypass cap in lab via config flag documented in COMMS-005).

## Non-goals

- Parent portal SMS APIs
- WhatsApp
- Resuming PAY-OPS as default work

## Solo-operator honesty

Provisional for EPIC-COMMS lab. OpenAPI companion may land with COMMS-003 implementation.
