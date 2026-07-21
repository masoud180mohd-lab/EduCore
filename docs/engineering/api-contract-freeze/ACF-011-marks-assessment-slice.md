# API Contract Freeze — Marks / Assessment (ACF-011)

| Field     | Value                                    |
| --------- | ---------------------------------------- |
| Freeze ID | `ACF-011`                                |
| Version   | `1.1`                                    |
| Date      | 2026-07-21                               |
| Companion | DBF-011                                  |
| Authority | Solo-operator provisional (SOLO-GOV-001) |

## Scope

| In scope                      | Out of scope       |
| ----------------------------- | ------------------ |
| Exams list/get/create         | Report cards       |
| Exam subjects list/get/create | Parent results BFF |
| Marks get + bulk PUT          | Offline sync       |
| Submit / approve exam-subject | Nested student PII |

All routes: Bearer + `X-Tenant-Id`. Marks payloads are ids-only.

## Resources (allowlists)

**Exam:** `id`, `tenantId`, `name`, `academicYearId`, `termId`, `classId`, `status`, `createdAt`, `updatedAt`

**ExamSubject:** `id`, `tenantId`, `examId`, `subjectId`, `maxScore`, `status`, `createdAt`, `updatedAt`

**Mark:** `id`, `tenantId`, `examSubjectId`, `studentId`, `score`, `note`, `createdAt`, `updatedAt`

## Endpoints

| Method | Path                                            | AuthZ                            |
| ------ | ----------------------------------------------- | -------------------------------- |
| GET    | `/api/v1/exams`                                 | marks.read                       |
| POST   | `/api/v1/exams`                                 | marks.manage (+ Idempotency-Key) |
| GET    | `/api/v1/exams/{examId}`                        | marks.read                       |
| GET    | `/api/v1/exams/{examId}/subjects`               | marks.read                       |
| POST   | `/api/v1/exams/{examId}/subjects`               | marks.manage (+ Idempotency-Key) |
| GET    | `/api/v1/exam-subjects/{examSubjectId}`         | marks.read                       |
| GET    | `/api/v1/exam-subjects/{examSubjectId}/marks`   | marks.read                       |
| PUT    | `/api/v1/exam-subjects/{examSubjectId}/marks`   | marks.manage (+ Idempotency-Key) |
| POST   | `/api/v1/exam-subjects/{examSubjectId}/submit`  | marks.manage                     |
| POST   | `/api/v1/exam-subjects/{examSubjectId}/approve` | marks.approve                    |

### Query (exams list)

`limit`, `cursor`, `status`, `classId`

### PUT marks body

```json
{ "records": [{ "studentId": "uuid", "score": 72.5, "note": null }] }
```

Enrollment-gated (active for exam class). Reject if exam_subject status ≠ `draft` (409). Score must be null or within `0…maxScore`.

### Submit / approve

- submit: `draft` → `submitted` (409 if not draft)
- approve: `submitted` → `approved` (409 otherwise)

## Solo-operator honesty

Provisional for IMP-008.
