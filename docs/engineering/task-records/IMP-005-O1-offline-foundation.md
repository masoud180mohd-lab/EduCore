# IMP-005-O1 — Attendance offline foundation (docs)

| Field   | Value      |
| ------- | ---------- |
| Program | IMP-005    |
| Wave    | O          |
| Date    | 2026-07-21 |

## Scope

Document offline operation envelopes aligned with `EduCore/21_OFFLINE_SYNC_BIBLE.md`. No sync engine, no `offline_operation_stubs` table in v1.

## Operation types

| Operation                   | HTTP twin                                      | Idempotency key scope                     |
| --------------------------- | ---------------------------------------------- | ----------------------------------------- |
| `attendance.session.open`   | `POST /api/v1/attendance-sessions`             | `{tenant, actor, route, key}` + body hash |
| `attendance.records.upsert` | `PUT /api/v1/attendance-sessions/{id}/records` | same                                      |
| `attendance.session.close`  | `POST /api/v1/attendance-sessions/{id}/close`  | recommended                               |

## Envelope sketch (future worker)

```json
{
  "operationType": "attendance.records.upsert",
  "clientMutationId": "<uuid>",
  "idempotencyKey": "<uuid>",
  "tenantId": "<from-device-bind-not-body>",
  "payload": {
    "sessionId": "<uuid>",
    "records": [{ "studentId": "<uuid>", "status": "present" }]
  }
}
```

Worker replays through existing SECURITY DEFINER helpers; enrollment + open-session rules unchanged.

## Readiness

- Mutation endpoints already idempotent (HTTP `Idempotency-Key` header).
- DB writes only via helpers; educore_app has SELECT on tables + EXECUTE on helpers.
- Future: device-bound tenant context + queued replay ordering per session.

## Not implemented

- Conflict resolution UI, partial sync, attachment of offline queue to Nest module.
