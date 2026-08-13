# IMP-046 — Enrollments class picker scoped by year

| Field     | Value                                    |
| --------- | ---------------------------------------- |
| Program   | **IMP-046**                              |
| Date      | 2026-08-13                               |
| Status    | **Done** (solo-operator provisional)     |
| Depends   | IMP-043 year/stream filters · ACF-008    |
| Authority | Solo-operator provisional (SOLO-GOV-001) |

## Outcome

When filtering enrollments by academic year, the class picker lists only classes for that year (`GET /classes?academicYearId=`). Changing year clears class (and thus stream). Create form still uses the full class list. No new APIs. PAY-OPS still deferred.

## Delivered

- Separate filter class picker + Load more, keyed by `yearFilter`
- Year change resets `classFilter` (stream already resets on class change)

## Explicitly not done

- Create-form class scoped by a year field
- Receipts list filters / PAY-OPS
