# API Contract Freeze Records

Engineering design freezes for public HTTP contracts. These refine `EduCore/06_API_SPECIFICATION.md` for a concrete slice and do **not** replace the immutable kit.

## Authority order

1. Development Constitution + accepted ADRs
2. Architecture Freeze v1.0
3. Accepted Database Freeze for the same slice (e.g. DBF-001)
4. Accepted API Contract Freeze documents here
5. Implementation PRs

## Records

| ID      | Slice             | Document                                                                           | OpenAPI                                                                                                              | Status                                         |
| ------- | ----------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| ACF-001 | Identity & Tenant | [ACF-001-identity-tenant-slice.md](./ACF-001-identity-tenant-slice.md)             | [openapi/acf-001-identity-tenant.openapi.yaml](./openapi/acf-001-identity-tenant.openapi.yaml)                       | **Accepted v1.0 (solo-operator)**              |
| ACF-002 | Student Registry  | [ACF-002-student-registry-list-slice.md](./ACF-002-student-registry-list-slice.md) | [openapi/acf-002-007-students-academic.openapi.yaml](./openapi/acf-002-007-students-academic.openapi.yaml)           | Provisional + OpenAPI (ASSURE-001; no re-sign) |
| ACF-003 | Academic Years    | [ACF-003-academic-years-list-slice.md](./ACF-003-academic-years-list-slice.md)     | [openapi/acf-002-007-students-academic.openapi.yaml](./openapi/acf-002-007-students-academic.openapi.yaml)           | Provisional + OpenAPI (ASSURE-001; no re-sign) |
| ACF-004 | Terms             | [ACF-004-terms-list-slice.md](./ACF-004-terms-list-slice.md)                       | [openapi/acf-002-007-students-academic.openapi.yaml](./openapi/acf-002-007-students-academic.openapi.yaml)           | Provisional + OpenAPI (ASSURE-001; no re-sign) |
| ACF-005 | Classes           | [ACF-005-classes-list-slice.md](./ACF-005-classes-list-slice.md)                   | [openapi/acf-002-007-students-academic.openapi.yaml](./openapi/acf-002-007-students-academic.openapi.yaml)           | Provisional + OpenAPI (ASSURE-001; no re-sign) |
| ACF-006 | Streams           | [ACF-006-streams-list-slice.md](./ACF-006-streams-list-slice.md)                   | [openapi/acf-002-007-students-academic.openapi.yaml](./openapi/acf-002-007-students-academic.openapi.yaml)           | Provisional + OpenAPI (ASSURE-001; no re-sign) |
| ACF-007 | Subjects          | [ACF-007-subjects-list-slice.md](./ACF-007-subjects-list-slice.md)                 | [openapi/acf-002-007-students-academic.openapi.yaml](./openapi/acf-002-007-students-academic.openapi.yaml)           | Provisional + OpenAPI (ASSURE-001; no re-sign) |
| ACF-008 | Enrollments       | [ACF-008-enrollments-slice.md](./ACF-008-enrollments-slice.md)                     | [openapi/acf-008-009-enrollments-attendance.openapi.yaml](./openapi/acf-008-009-enrollments-attendance.openapi.yaml) | Provisional + OpenAPI (no re-sign)             |
| ACF-009 | Attendance        | [ACF-009-attendance-slice.md](./ACF-009-attendance-slice.md)                       | [openapi/acf-008-009-enrollments-attendance.openapi.yaml](./openapi/acf-008-009-enrollments-attendance.openapi.yaml) | Provisional + OpenAPI (no re-sign)             |
| ACF-010 | Guardians         | [ACF-010-guardians-slice.md](./ACF-010-guardians-slice.md)                         | [openapi/acf-010-011-guardians-marks.openapi.yaml](./openapi/acf-010-011-guardians-marks.openapi.yaml)               | Provisional + OpenAPI (no re-sign)             |
| ACF-011 | Marks/Assessment  | [ACF-011-marks-assessment-slice.md](./ACF-011-marks-assessment-slice.md)           | [openapi/acf-010-011-guardians-marks.openapi.yaml](./openapi/acf-010-011-guardians-marks.openapi.yaml)               | Provisional + OpenAPI (rev 1.1; no re-sign)    |

**Layout note (ASSURE-001 D1):** ACF-002…007 share one combined OpenAPI file for reviewability. ACF-008/009 share another. ACF-010/011 share another. ACF-001 remains its own file.

## Rules

- Freeze ≠ implementation (no controllers required to “complete” the freeze).
- Breaking changes need a new version or superseding freeze revision.
- Cross-tenant leakage is a release blocker; contracts must fail closed.
- Publishing OpenAPI YAML does **not** re-accept freezes under SOLO-GOV-001.
