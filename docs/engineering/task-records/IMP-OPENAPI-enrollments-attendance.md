# IMP-OPENAPI — Enrollments + Attendance OpenAPI (AUDIT-R5 High)

| Field     | Value                     |
| --------- | ------------------------- |
| Program   | IMP-OPENAPI (slice 1)     |
| Date      | 2026-07-21                |
| Authority | Solo-operator provisional |

## Outcome

Close AUDIT-R5 High backlog item **OpenAPI for product slices** for the two newest domains:

- ACF-008 enrollments (list/get/create/patch)
- ACF-009 attendance sessions + records

Does **not** re-accept freezes or expand to students/academic-years OpenAPI yet (follow-up).

## Deliverables

| Area    | Path                                                                                           |
| ------- | ---------------------------------------------------------------------------------------------- |
| OpenAPI | `docs/engineering/api-contract-freeze/openapi/acf-008-009-enrollments-attendance.openapi.yaml` |
| Tooling | `tests/tooling/imp-openapi-enrollments-attendance.test.ts`                                     |
| ACF md  | Cross-links in ACF-008 / ACF-009                                                               |

## Residual

- OpenAPI still missing for ACF-002…007 (students + academic structure).
- Live product isolation matrix still open (needs Postgres).

## Verification

`npm run check`
