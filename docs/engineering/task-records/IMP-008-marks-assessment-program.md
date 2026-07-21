# IMP-008 — Online Marks / Assessment

| Field     | Value                     |
| --------- | ------------------------- |
| Program   | IMP-008                   |
| Date      | 2026-07-21                |
| Authority | Solo-operator provisional |

## Discovery

| Dependency                         | Status                                 |
| ---------------------------------- | -------------------------------------- |
| Students / academics / enrollments | Green                                  |
| Teacher web shell (IMP-006)        | Green                                  |
| Assessment Nest module             | Product HTTP delivered in this program |

## Waves

| Wave | Work                               | Status |
| ---- | ---------------------------------- | ------ |
| M0   | DSF-003 + DBF-011 + ACF-011        | Done   |
| M1   | Schema + Nest HTTP + unit tests    | Done   |
| M2   | Teacher marks UI + tooling + check | Done   |

## API

| Method   | Path                                 | Permission          |
| -------- | ------------------------------------ | ------------------- |
| GET/POST | `/api/v1/exams`                      | marks.read / manage |
| GET      | `/api/v1/exams/{id}`                 | marks.read          |
| GET/POST | `/api/v1/exams/{id}/subjects`        | marks.read / manage |
| GET      | `/api/v1/exam-subjects/{id}`         | marks.read          |
| GET/PUT  | `/api/v1/exam-subjects/{id}/marks`   | marks.read / manage |
| POST     | `/api/v1/exam-subjects/{id}/submit`  | marks.manage        |
| POST     | `/api/v1/exam-subjects/{id}/approve` | marks.approve       |

## Web

- `/t/[tenantId]/teacher/marks`
- `/t/[tenantId]/teacher/marks/exams/[examId]`
- `/t/[tenantId]/teacher/marks/subjects/[examSubjectId]`

## Run

```bash
npm run db:migrate
npm run rbac:reconcile-grants
npm run start:dev
npm run dev:web
```

## Residual

- Report cards / offline marks queue deferred
- Playwright e2e not run
- Existing tenants need `npm run db:migrate` + `npm run rbac:reconcile-grants`

## Residual fixed (follow-up)

- GET `/api/v1/exam-subjects/{id}` (ACF-011 rev 1.1); teacher UI no longer needs `?examId=`
- OpenAPI YAML for ACF-010 + ACF-011

## Next

Fees/finance foundation, parent portal, or ASSURE live FE e2e.
