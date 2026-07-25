# IMP-018 — Enrollment transfer

| Field     | Value                                                  |
| --------- | ------------------------------------------------------ |
| Program   | **IMP-018**                                            |
| Date      | 2026-07-25                                             |
| Authority | Solo-operator provisional                              |
| Contracts | ACF-008 rev **1.4**; DBF-008 rev **1.3**; DSF-002 v1.7 |

## Goal

In-place enrollment transfer (class/stream) via PATCH, preserving enrollment id.

## Waves

| Wave | Work                                  | Status |
| ---- | ------------------------------------- | ------ |
| 0    | ACF/DBF/DSF + this record             | Done   |
| 1    | Nest `app.patch_enrollment` + service | Done   |
| 2    | Admin detail transfer UI              | Done   |
| 3    | Tooling + QA + check + commit         | Done   |

## Behavior

- PATCH allowlist: `status`, `classId`, `streamId` (null clears); at least one required
- When `classId` set and `streamId` omitted → stream cleared; year/term re-derived from class
- 409 unique open; 400 stream/class mismatch

## Manual QA

Checklist: `tasks/manual-test-enrollment-transfer-qa.md`

## Non-goals

- Bulk transfer; one-open-per-student-year unique rewrite
- Fee rebind; Roles; Settings
