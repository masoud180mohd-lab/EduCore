# COMMS-006 — Notifications admin UI

| Field     | Value                                       |
| --------- | ------------------------------------------- |
| Program   | **COMMS-006** / EPIC-COMMS-01               |
| Date      | 2026-08-03                                  |
| Depends   | COMMS-001…005, ACF-014, IMP-030/033/034/035 |
| Authority | Solo-operator provisional                   |

## Goal

First tenant admin surface to inspect SMS deliveries, view daily usage, and send a manual test SMS (Fake/Beem via existing Nest APIs).

## Route choice

**`/t/{tenantId}/admin/notifications`** (nav label **SMS**).

Justification: ACF-014 and permission codes use `notification.*`; path matches API prefix `/api/v1/notifications/*`. Nav label “SMS” is clearer for operators than “Comms”.

## Delivered

| Piece              | Path                                                         |
| ------------------ | ------------------------------------------------------------ |
| Page               | `apps/web/src/app/t/[tenantId]/admin/notifications/page.tsx` |
| Types / allowlists | `apps/web/src/lib/notifications/types.ts`                    |
| Nav gate           | `admin-access` + `AdminShell` + admin home hub               |
| Error domain       | `adminFriendlyMessage(..., 'notifications')`                 |

### Screen A — Deliveries

- `GET /notifications/deliveries` with cursor Load more (limit 50)
- Filters: status, requestId
- Columns: createdAt, status, request id (short), providerCode, phoneLast4 (`····NNNN`), segmentCount, errorCode
- **Never** renders full MSISDN

### Screen B — Send test SMS

- Visible when `canNotificationManage` (owner/admin or `notification.manage`)
- Templates from `GET /notification-templates`; payload fields from catalog allowlist
- Guardian picker (`GET /guardians?limit=100`) — shows “has phone” / “no phone”, not digits
- `POST /notifications/requests` with Idempotency-Key (session-stable until success)
- ConfirmDialog before send
- Result banner includes `skipped (no_phone)` when applicable; then refresh usage + deliveries

### Screen C — Usage

- `GET /notifications/usage` (today UTC) above list: sentCount, segmentCount, dailyCap / bypass

### Nav

- Nav id `notifications`, group **Notifications**, label **SMS**
- Visible when `notification.read` \| `notification.manage` (owners/admins always)
- Shell access includes notification.* so SMS-only staff can enter Admin

## Non-goals (honored)

Template editor, bulk blast, WhatsApp, parent inbox, domain-event auto wiring, Beem live key setup.

## Manual QA

1. Sign in as owner → Admin → SMS → usage panel loads; deliveries list (empty OK).
2. Apply status filter + Load more when >50 rows exist.
3. Confirm table shows `····` + last4 only — never full phone in DOM.
4. Send test: pick `comms_test_sms`, locale `sw`, guardian **with** phone, fill `school_name` → Confirm → status `sent`/`queued`; delivery row appears (Fake).
5. Send to guardian **without** phone → banner `skipped (no_phone)`; no fake success delivery.
6. Double-click Confirm while busy → buttons disabled; same Idempotency-Key — no double send.
7. Staff with only `notification.read` → can list, cannot see manage form (or sees info banner).
8. Staff without notification.* → SMS nav hidden; opening URL shows forbidden banner.

## Verify

```bash
npx vitest run apps/web/src/lib/notifications/types.test.ts \
  apps/web/src/lib/auth/admin-access.test.ts \
  tests/tooling/comms006-notifications-admin-ui.test.ts
npm run check
```

## Doubt checks

| Question                | Answer                       |
| ----------------------- | ---------------------------- |
| Full MSISDN in UI?      | No — phoneLast4 only         |
| skipped/no_phone clear? | Yes — request status banner  |
| Idempotent submit?      | Yes — Idempotency-Key + busy |
| Nav gated?              | Yes — notification.read      |
