# IMP-006-O — Offline readiness (stubs)

| Field   | Value   |
| ------- | ------- |
| Program | IMP-006 |
| Wave    | O       |

## Delivered

- `OfflineBanner` when `navigator.onLine === false`
- Copy: queue not enabled
- Mutations already use persisted Idempotency-Key per action (session.open / records.upsert / session.close) aligned with ACF-009 / IMP-005-O1

## Not delivered

Sync worker, service worker, conflict UI, offline queue persistence.
