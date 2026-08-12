# IMP-041 — Enrollments list filter parity

| Field     | Value                                      |
| --------- | ------------------------------------------ |
| Program   | **IMP-041**                                |
| Date      | 2026-08-12                                 |
| Status    | **Done** (solo-operator provisional)       |
| Depends   | IMP-038/040 Apply pattern · ACF-008        |
| Authority | Solo-operator provisional (SOLO-GOV-001)   |

## Outcome

Close the last IMP-038 Academic filter residual: Enrollments list uses the same draft/applied Apply + cursor pattern, and wires API `studentId` (class + status were already sent, but live-on-change).

## Delivered

| Filter | Notes |
| ------ | ----- |
| `studentId` | Picker + URL `?studentId=` applies as list filter and still prefills create |
| `classId` | Draft → Apply (was live `useEffect`) |
| `status` | Draft → Apply |

- `AdminPageHeader` + `Banner`
- Load more keeps **applied** filters

## Explicitly not done

- Receipts list filters (API has none)
- Org parent picker redesign
- ~~Enrollments `academicYearId` / `streamId`~~ → **IMP-043**
- PAY-OPS
