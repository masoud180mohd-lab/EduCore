# IMP-019 — Admin Settings edit + Guardian profile edit

| Field     | Value                                                                  |
| --------- | ---------------------------------------------------------------------- |
| Program   | **IMP-019**                                                            |
| Date      | 2026-07-25                                                             |
| Authority | Solo-operator provisional                                              |
| Contracts | ACF-001 tenant-settings PUT; guardians PATCH (unchanged); DSF-002 v1.8 |

## Goal

UI-only: Settings form via PUT; guardian detail profile edit via PATCH.

## Waves

| Wave | Work                          | Status |
| ---- | ----------------------------- | ------ |
| 0    | DSF-002 amend + this record   | Done   |
| 1    | Settings PUT form             | Done   |
| 2    | Guardian detail profile PATCH | Done   |
| 3    | Tooling + QA + check + commit | Done   |

## Routes

- `/t/[tenantId]/admin/settings` — edit + save
- `/t/[tenantId]/admin/guardians/[guardianId]` — profile form + existing bind/links

## Manual QA

Checklist: `tasks/manual-test-admin-settings-guardian-qa.md`

## Non-goals

- Membership lifecycle, Roles, MoMo, Nest changes
