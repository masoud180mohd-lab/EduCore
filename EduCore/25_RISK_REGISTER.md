# 25 Risk Register

## Critical Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Cross-tenant data leak | Company-ending trust failure | RLS, policy tests, search isolation |
| Payment misposting | Financial disputes | Immutable ledger, reconciliation, replay tests |
| Offline sync corruption | Wrong attendance/marks | Operation-based sync and conflict review |
| AI privacy leak | Legal and trust damage | AI Gateway, redaction, authorization |
| Scope overload | Delayed launch | Strict MVP gates |
| Unrestorable backups | Data loss | Restore drills |
| Weak authorization | Child data exposure | Policy and relationship-aware access |
| SMS/AI cost spike | Margin loss | Usage metering and budgets |

## High Risks

- Payment provider instability.
- WhatsApp template approval delays.
- Poor data quality for AI.
- Support access misuse.
- Migration failure.
- Over-customization per school.

## Risk Review Cadence

Review risks:

- before MVP build.
- before pilot.
- before public launch.
- monthly during growth.
- after every SEV-1 or SEV-2 incident.

