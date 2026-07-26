# IMP-022 — Roles Admin

| Field     | Value                                                |
| --------- | ---------------------------------------------------- |
| Program   | **IMP-022**                                          |
| Date      | 2026-07-25                                           |
| Authority | Solo-operator provisional                            |
| Contracts | ACF-001 §4.7 implement-against-freeze; DSF-002 v1.11 |

## Goal

Admin Roles UI + Nest RBAC product surface (list/create/rename/permissions + user-role assign).

## Waves

| Wave | Work                                   | Status |
| ---- | -------------------------------------- | ------ |
| 0    | DSF + this record                      | Done   |
| 1–2  | Nest reads + DEFINER writes            | Done   |
| 3    | Admin Roles pages + user-detail assign | Done   |
| 4    | QA + check + commit                    | Done   |

## Non-goals

Org-scoped assign UI; DELETE role; system permission replace via API
