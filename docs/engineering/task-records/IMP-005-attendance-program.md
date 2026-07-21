# IMP-005 — Attendance program (online surface)

| Field     | Value                     |
| --------- | ------------------------- |
| Program   | IMP-005                   |
| Date      | 2026-07-21                |
| Authority | Solo-operator provisional |

## Dependency inventory

| Dependency                            | Status          |
| ------------------------------------- | --------------- |
| Students list/detail/create/patch     | Green (IMP-002) |
| Academic years/terms/classes/streams  | Green (IMP-003) |
| Enrollments list/create/active filter | Green (IMP-004) |

## Surfaces delivered

| Method | Path                                       | Permission        |
| ------ | ------------------------------------------ | ----------------- |
| GET    | `/api/v1/attendance-sessions`              | attendance.read   |
| GET    | `/api/v1/attendance-sessions/{id}`         | attendance.read   |
| POST   | `/api/v1/attendance-sessions`              | attendance.manage |
| POST   | `/api/v1/attendance-sessions/{id}/close`   | attendance.manage |
| GET    | `/api/v1/attendance-sessions/{id}/records` | attendance.read   |
| PUT    | `/api/v1/attendance-sessions/{id}/records` | attendance.manage |

## Security invariants

- Enrollment-gated record upsert (active only; stream-aware when session stream set).
- Closed session rejects record PUT (409).
- Cross-tenant probes → 404 / validation (no existence leak).
- Audit: `attendance.session.create`, `attendance.session.close`, `attendance.records.upsert`.
- Idempotency required on POST session + PUT records; recommended on close.

## Increments

- A0: schema + freezes + repository
- A1/A2: list + detail
- B1/B2: create + close
- C1/C2: records get + bulk PUT
- D1: structural + HTTP AuthZ matrix + PERMISSION_CODES/staff grants
- O1: offline operation envelopes (docs only)

## Verification

- `npm run check` — green at program handoff.

## Residual / out of scope

- PATCH single record (skipped — bulk PUT sufficient).
- Full offline sync engine (Wave O docs only).
- Frontend teacher UI, marks, fees.

## Next program

Assessment/Marks, Guardians, or Frontend teacher attendance UI.
