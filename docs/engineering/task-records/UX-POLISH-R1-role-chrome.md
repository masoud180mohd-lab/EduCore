# UX-POLISH-R1 — Admin / teacher / parent chrome (no payments)

| Field     | Value                                            |
| --------- | ------------------------------------------------ |
| Program   | **UX-POLISH-R1**                                 |
| Date      | 2026-08-09                                       |
| Status    | **Done** (solo-operator provisional)             |
| Depends   | DSF-KIT-001 · DSF-001/003/006 · WEB-MFA-UI       |
| Authority | Solo-operator provisional (SOLO-GOV-001)         |

## Outcome

Small in-freeze UX hardening: class names instead of UUIDs, empty/loading attendance, parent ticket-ID cleanup, shared offline/metadata copy, MFA settings plain language.

## Delivered

- Teacher: class labels on sessions/marks; attendance loading/empty; session crumb + class name; hide student UUID under roster name
- Parent: Home nav; softer fees banner (no PAY ticket IDs); clearer load error
- Global: OfflineBanner + root metadata role-neutral; MFA_REQUIRED friendly copy; MFA panel jargon reduced
- MFA-HARD-OPS script companion (Owner flip)

## Explicitly not done

- Payments / ClickPesa / parent pay
- Live Doppler MFA hard flip (Owner machine)
