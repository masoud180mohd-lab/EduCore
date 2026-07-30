# IMP-034x — Teacher ConfirmDialog (Wave X)

| Field     | Value                                              |
| --------- | -------------------------------------------------- |
| Program   | **IMP-034** Wave X                                 |
| Date      | 2026-07-30                                         |
| Depends   | IMP-034 ConfirmDialog; DSF-001 / DSF-003           |
| Authority | Solo-operator provisional                          |

## Goal

Replace `window.confirm` on teacher marks **Submit** and attendance **Close session** with shared `ConfirmDialog`.

## Migrated

| Path | Action | Status |
| ---- | ------ | ------ |
| `teacher/marks/subjects/[examSubjectId]` | Submit | Done |
| `teacher/attendance/sessions/[sessionId]` | Close session | Done |

## Verify

```bash
npx vitest run tests/tooling/imp034-admin-confirm-modal.test.ts
```

Teacher tree must have **zero** `window.confirm`.
