# IMP-054 — Head portal Phase 3a (dashboard + marks approvals)

| Field     | Value                                                |
| --------- | ---------------------------------------------------- |
| Task      | IMP-054                                              |
| Date      | 2026-08-20                                           |
| Status    | **Landed** (lab)                                     |
| Governing | DSF-008 v1.0 · SPEC-PORTALS-001 P4 · ACF-011 approve |

## Summary

- `HeadShell` Digii + amber tint `#8a5a13`
- `/t/:id/head` dashboard from existing summary GETs
- `/t/:id/head/approvals` submitted exam-subjects → approve
- Post-login priority: Head before Admin when `marks.approve` / owner/admin
- Workspace switcher includes Head

## Deferred

Delegation (7 fields), Head KPI BFF, exceptions, school audit, API self-approval golden test

## Verify

- `npm run typecheck -w @educore/web`
- `npm test -w @educore/web`
- Manual: login as owner → `/head`; Approvals queue; switcher → Office
