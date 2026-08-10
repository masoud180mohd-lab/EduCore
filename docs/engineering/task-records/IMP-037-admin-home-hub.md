# IMP-037 — Admin home hub clarity

| Field     | Value                                    |
| --------- | ---------------------------------------- |
| Program   | **IMP-037**                              |
| Date      | 2026-08-10                               |
| Status    | **Done** (solo-operator provisional)     |
| Depends   | IMP-029 nav IA · IMP-033 authz gate      |
| Authority | Solo-operator provisional (SOLO-GOV-001) |

## Outcome

Make Admin home usable as a directory: clearer copy, loading/empty states, and deep links for common next steps. No new APIs.

## Delivered

- `AdminPageHeader` + school name in description
- Loading copy while `/auth/me` resolves; empty banner when no areas for permissions
- **Common next steps** deep links (students, invite, enrollments, invoices, guardians, SMS) filtered by `visibleAdminNavIds`
- Sharper hub card blurbs (filters / lifecycle hints)
- Academic + Fees hubs: back link to Admin, `AdminPageHeader`, Fees uses `Banner`
- Shared map/helpers: `apps/web/src/lib/admin/admin-hub.ts` + unit tests

## Explicitly not done

- Live counts / KPI tiles on home
- Marketing redesign
- Payments / ClickPesa
