# IMP-026 — Org-scoped user-role assignment (admin)

| Field     | Value                                           |
| --------- | ----------------------------------------------- |
| Program   | **IMP-026**                                     |
| Date      | 2026-07-27                                      |
| Authority | Solo-operator provisional                       |
| Contracts | ACF-001 rev **1.6**; DSF-002 v**1.14**; DEFINER |

## Goal

Store and administer user-role assignments scoped to an organization or tenant-wide (`organizationId` null).

## Honesty

Permissions still union tenant-wide in policy evaluation — org scope is **assignment metadata only** until a future AuthZ IMP.

## Waves

| Wave | Work                                 | Status |
| ---- | ------------------------------------ | ------ |
| 0    | FK/trigger + assign_user_role(org)   | Done   |
| 1    | Nest POST parse + repository + tests | Done   |
| 2    | User detail scope UI + docs          | Done   |
| 3    | Tooling + check + commit             | Done   |

## Non-goals

- Org-scoped permission enforcement / guards
- `GET /user-roles?organizationId=` filter
- Role DELETE
