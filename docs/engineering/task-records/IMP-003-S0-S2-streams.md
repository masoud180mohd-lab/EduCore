# IMP-003-S0/S1/S2 — Streams list, detail, create

## Outcome

Product streams under a class: `GET /api/v1/streams`, `GET /api/v1/streams/{id}`, `POST /api/v1/streams`.

## Status

**Complete** (2026-07-21). Freezes DBF-006 / ACF-006 (solo-operator provisional).

## AuthZ

| Method          | Path       | Permission                                   |
| --------------- | ---------- | -------------------------------------------- |
| GET list/detail | `/streams` | `academic.read`                              |
| POST            | `/streams` | `academic.manage` + Idempotency-Key required |

## Implementation

| Layer                         | Path                                                  |
| ----------------------------- | ----------------------------------------------------- |
| Migration list                | `20260720250000_streams_list_read`                    |
| Migration create              | `20260720260000_streams_create` (`app.create_stream`) |
| Controller/Service/Repository | `streams.*`                                           |

## Non-goals

PATCH/DELETE; enrollments.
