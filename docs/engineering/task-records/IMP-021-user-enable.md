# IMP-021 — User re-enable

| Field     | Value                                         |
| --------- | --------------------------------------------- |
| Program   | **IMP-021**                                   |
| Date      | 2026-07-25                                    |
| Authority | Solo-operator provisional                     |
| Contracts | ACF-001 v1.5 (`POST …/enable`); DSF-002 v1.10 |

## Goal

Operators can re-enable a platform-disabled user from Admin user detail (mirror of IMP-016 disable).

## Waves

| Wave | Work                                 | Status |
| ---- | ------------------------------------ | ------ |
| 0    | ACF/OpenAPI + DSF + this record      | Done   |
| 1    | Nest `app.enable_user` + route/tests | Done   |
| 2    | Admin Enable button + check + commit | Done   |

## Rules

- `disabled` → `active`; already `active` → 200; other/missing → 404
- Reject self-enable; leave membership unchanged

## Non-goals

Roles Admin (IMP-022), membership lifecycle, locked→active
