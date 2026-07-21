# IMP-003-J0/J1/J2 — Subjects list, detail, create

## Outcome

Tenant subject catalogue: `GET /api/v1/subjects`, `GET /api/v1/subjects/{id}`, `POST /api/v1/subjects`.

## Status

**Complete** (2026-07-21). Freezes DBF-007 / ACF-007 (solo-operator provisional).

## AuthZ

| Method          | Path        | Permission                                   |
| --------------- | ----------- | -------------------------------------------- |
| GET list/detail | `/subjects` | `academic.read`                              |
| POST            | `/subjects` | `academic.manage` + Idempotency-Key required |

## Implementation

| Layer                         | Path                                                    |
| ----------------------------- | ------------------------------------------------------- |
| Migration list                | `20260720270000_subjects_list_read`                     |
| Migration create              | `20260720280000_subjects_create` (`app.create_subject`) |
| Controller/Service/Repository | `subjects.*`                                            |

## Non-goals

Class-subject assignments; PATCH/DELETE.
