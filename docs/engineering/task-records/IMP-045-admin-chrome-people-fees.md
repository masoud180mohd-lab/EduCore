# IMP-045 — Admin chrome: Students / Guardians / Users / Fees details

| Field     | Value                                      |
| --------- | ------------------------------------------ |
| Program   | **IMP-045**                                |
| Date      | 2026-08-12                                 |
| Status    | **Done** (solo-operator provisional)       |
| Depends   | IMP-044 Academic/Roles chrome              |
| Authority | Solo-operator provisional (SOLO-GOV-001)   |

## Outcome

Finish Admin detail chrome wave: Students, Guardians (+ guardian fees read-only), Users, Fee structure/invoice/receipt → `AdminPageHeader` + `Banner`. No API changes. PAY-OPS still deferred.

## Delivered

| Surface | Fix |
| ------- | --- |
| Students / Users / Guardians detail | Header + Banner |
| Fee structure / invoice / receipt detail | Header + Banner (momo Fake notice stays `warn`) |
| Guardian fees nested pages | Header + Banner; pay-at-office notices remain info |

## Explicitly not done

- Receipts **list** filters (API has none)
- PAY-OPS / ClickPesa
- Memberships/notifications detail if any residual (lists already polished)
