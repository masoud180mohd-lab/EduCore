# IMP-053 — Teacher Workspace modes (Darasa / Somo)

| Field     | Value                                                                 |
| --------- | --------------------------------------------------------------------- |
| Task      | IMP-053                                                               |
| Date      | 2026-08-20                                                            |
| Status    | **Landed** (lab)                                                      |
| Governing | SPEC-PORTALS-001 D1 · DSF-001 v1.2 · DSF-003 v1.2 · DSF-KIT-002 Digii |

## Summary

Phase 2 re-shell over existing attendance/marks (no new domain API):

- Mode tabs **Darasa | Somo** under Digii top bar when actor has both capabilities
- Nav filtered by mode; Leo (today) header on teacher surfaces
- Default mode via D1 decision table + sessionStorage last-used (server preference deferred to portal-preference ACF)
- Visibility from `attendance.manage` / `marks.manage` (staff without listed perms → both, interim)

## Verify

- `npm run typecheck -w @educore/web`
- `npm test -w @educore/web` (includes `lib/teacher/mode.test.ts`)
- Manual: `/t/{tenant}/teacher` — tabs, switch to Somo → marks home

## Honesty

- Not production GO
- Class-teacher vs subject-teacher assignment matrix still absent — capability is permission-based
- Last-used is sessionStorage, not server-side preference
