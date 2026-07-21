# IMP-004 Enrollments Program (E0–E4)

## Status

**Complete** (2026-07-21). Solo-operator provisional freezes.

## Increments

| ID  | Work                                          |
| --- | --------------------------------------------- |
| E0  | DBF-008 + ACF-008 freezes; table SELECT-only  |
| E1  | GET `/api/v1/enrollments` list                |
| E2  | GET `/api/v1/enrollments/{id}` detail         |
| E3  | POST create + `app.create_enrollment`         |
| E4  | PATCH status + `app.update_enrollment_status` |

## Freezes

- `docs/engineering/database-freeze/DBF-008-enrollments-slice.md`
- `docs/engineering/api-contract-freeze/ACF-008-enrollments-slice.md` rev 1.3

## Security locks

- Year/term derived from class (not body)
- Student, class, stream tenant-bound in helper
- Stream must match class_id
- Unique active/suspended per student+class+year
- academic.read / academic.manage only
- Module: academic-structure (not student-registry)

## Doubt answers

| Question                    | Answer                                   |
| --------------------------- | ---------------------------------------- |
| Cross-tenant student/class? | No — helper EXISTS checks with tenant_id |
| Stream wrong class?         | Rejected `stream not found` → 400        |
| Body academicYearId?        | Not accepted; set from class             |
