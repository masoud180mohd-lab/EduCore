# IMP-017 — AdminShell school name

| Field     | Value                                                    |
| --------- | -------------------------------------------------------- |
| Program   | **IMP-017**                                              |
| Date      | 2026-07-25                                               |
| Authority | Solo-operator provisional                                |
| Contracts | ACF-001 `GET /tenants/current` (unchanged); DSF-002 v1.6 |

## Goal

Show the bound tenant school name in `AdminShell` header on every Admin page (UI-only).

## Waves

| Wave | Work                                        | Status |
| ---- | ------------------------------------------- | ------ |
| 0    | DSF-002 amend + this record                 | Done   |
| 1    | AdminShell fetch + tooling + check + commit | Done   |

## Behavior

- After session ready: `GET /api/v1/tenants/current`
- Brand: `name` → `code` → fallback `EduCore Admin`
- Fail soft: keep fallback on error; do not block children

## Manual QA

1. Open any Admin page → header shows school name
2. Home still works
3. (Optional) Block API → header falls back to `EduCore Admin`

## Non-goals

- Enrollment transfer (next program)
- Teacher/Parent shells, Roles, Settings edit
