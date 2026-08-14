# API Contract Freeze — Marks / Assessment (ACF-011)

| Field     | Value                                    |
| --------- | ---------------------------------------- |
| Freeze ID | `ACF-011`                                |
| Version   | `1.2`                                    |
| Date      | 2026-08-14                               |
| Companion | DBF-011                                  |
| Authority | Solo-operator provisional (SOLO-GOV-001) |

## Scope

| In scope                      | Out of scope       |
| ----------------------------- | ------------------ |
| Exams list/get/create         | Parent results BFF |
| Exam subjects list/get/create | Offline sync       |
| Marks get + bulk PUT          | Nested student PII |
| Submit / approve exam-subject | Stored letter grades |
| Report-card compose + PDF (rev 1.2) | Writable `grade` column |

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
| GET    | `/api/v1/exams/{examId}/report-cards`           | marks.read                       |
| GET    | `/api/v1/exams/{examId}/report-cards/{studentId}` | marks.read                     |
| GET    | `/api/v1/exams/{examId}/report-cards/{studentId}/pdf` | marks.read (`application/pdf`) |

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

## Report cards (rev 1.2 / IMP-048)

Composition only — no `grade` column. Letter grade is **derived**: A ≥80, B ≥70, C ≥60, D ≥50, F below. Average is the mean of subject percentages that have a score. PDF is a minimal PDF 1.4 (Helvetica, Latin text). Names resolved via Students/Subjects/Classes services (no cross-module table SELECT).

## Solo-operator honesty

Provisional for IMP-008.
