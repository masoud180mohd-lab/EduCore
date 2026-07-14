# 21 Offline Sync Bible

## Offline Strategy

Offline is not a blanket platform feature. It is approved per workflow.

Approved order:

1. Attendance.
2. Marks.
3. Remarks.
4. Timetable cache.
5. Cached reports.

## Sync Model

Use operation-based sync, not blind row replacement.

Every offline operation includes:

- client operation ID.
- tenant ID.
- user ID.
- device ID.
- operation type.
- entity type.
- entity ID.
- payload.
- base version.
- idempotency key.
- client timestamp.

Server returns:

- accepted.
- rejected.
- conflict.
- needs review.
- canonical version.

## Conflict Rules

Attendance:

- duplicate operations are ignored.
- teacher permission is rechecked at sync time.
- corrections after approval require audit.

Marks:

- no last-write-wins for approved marks.
- conflicts require review.
- submitted/approved marks have stricter rules.

Deletes:

- offline delete should usually become a request, not immediate deletion.

## Offline Security

- Offline grants expire.
- Local data should be encrypted where practical.
- Logout clears sensitive local data.
- Role changes may invalidate offline operations.

## UX Requirements

Show:

- saved locally.
- pending sync.
- synced.
- conflict.
- failed.

Never show pending offline data as officially accepted.

