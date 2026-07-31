# PAY-001 — Select MVP payment provider

| Field     | Value                                                    |
| --------- | -------------------------------------------------------- |
| Program   | **PAY-001** / EPIC-PAY-01                                |
| Date      | 2026-07-31                                               |
| Status    | **Accepted** (solo-operator)                             |
| Brief     | `docs/engineering/decisions/PAY-001-mvp-provider-brief.md` |
| Choice    | **A + ClickPesa** · Zanzibar · rails M-Pesa + Mixx       |
| Next      | **PAY-002** adapter contract                             |
| Authority | Solo-operator provisional (SOLO-GOV-001)                 |

## Goal

Close the open payment-provider limitation so gated MoMo adapter work can start without inventing a vendor.

## Done

- [x] Decision brief with Zanzibar analysis
- [x] Project Owner Accept (2026-07-31)
- [x] Amend `PAY-PROVIDER-001`
- [x] Point status / limitations at ClickPesa choice + PAY-002 next
- [ ] Sandbox merchant registration (operator — outside code)
- [ ] PAY-002 adapter contract

## Non-goals

Implementing ClickPesa SDK/webhook in this task.
