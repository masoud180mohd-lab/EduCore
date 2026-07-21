# IMP-005-D1 — Attendance AuthZ hardening

| Field     | Value                     |
| --------- | ------------------------- |
| Program   | IMP-005 Attendance        |
| Increment | D1                        |
| Date      | 2026-07-21                |
| Authority | Solo-operator provisional |

## Delivered

- `PERMISSION_CODES` includes `attendance.read` / `attendance.manage`.
- Staff system role grants both attendance permissions (teacher classroom flow).
- Structural tooling: `tests/tooling/imp005-attendance.test.ts`.
- HTTP AuthZ matrix extended in `product-reads-authz.http.test.ts` (200/403/400/404).

## Verification

- `npm run check` — must pass before program handoff.

## Skipped

- IMP-005-D2 PATCH single record — bulk PUT sufficient.
