# IMP-025 — Academic delete dependents listing

| Field     | Value                                                       |
| --------- | ----------------------------------------------------------- |
| Program   | **IMP-025**                                                 |
| Date      | 2026-07-27                                                  |
| Authority | Solo-operator provisional                                   |
| Contracts | ACF-003…007 DELETE amend; DSF-002 v**1.13**; DEFINER detail |

## Goal

When academic DELETE is blocked by dependents, API returns structured `409 error.details.dependents` and Admin detail pages list blockers with links.

## Policy

- Empty-only delete unchanged (no cascade).
- Up to 5 samples per dependent type in DETAIL JSON.
- No dedicated list dependents GET.

## Waves

| Wave | Work                                    | Status |
| ---- | --------------------------------------- | ------ |
| 0    | Migration DETAIL + Nest map + tests     | Done   |
| 1    | Admin dependents banner + OpenAPI + DSF | Done   |
| 2    | Tooling + check + commit                | Done   |

## Non-goals

- Cascade delete
- Pre-delete dependents preview without attempting delete
