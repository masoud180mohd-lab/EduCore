# IMP-043 — Enrollments year + stream list filters

| Field     | Value                                      |
| --------- | ------------------------------------------ |
| Program   | **IMP-043**                                |
| Date      | 2026-08-12                                 |
| Status    | **Done** (solo-operator provisional)       |
| Depends   | IMP-041 · ACF-008 list query               |
| Authority | Solo-operator provisional (SOLO-GOV-001)   |

## Outcome

Wire remaining ACF-008 enrollment list filters: `academicYearId` and `streamId`, same Apply/cursor pattern as IMP-041. No new APIs. PAY-OPS stays deferred.

## Delivered

| Filter | Notes |
| ------ | ----- |
| `academicYearId` | Year picker + Load more |
| `streamId` | Enabled after class filter selected (streams are class-scoped) |

- Load more keeps all **applied** filters (year/student/class/stream/status)
- Hub enroll quick-start hint updated

## Explicitly not done

- ~~Class picker scoped by selected year~~ → **IMP-046**
- Receipts filters / PAY-OPS
