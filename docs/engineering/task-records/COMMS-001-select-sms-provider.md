# COMMS-001 — Select MVP SMS provider

| Field     | Value                                        |
| --------- | -------------------------------------------- |
| Program   | **COMMS-001** / EPIC-COMMS-01                |
| Date      | 2026-08-03                                   |
| Status    | **Proposed** — awaiting Owner “sawa”         |
| Depends   | Kit next milestone EPIC-COMMS; PAY-OPS deferred |
| Decision  | `docs/engineering/decisions/COMMS-001-mvp-sms-provider.md` |
| Authority | Solo-operator provisional (SOLO-GOV-001)     |

## Recommendation

**Beem Africa** (`provider_code=beem`); Fake CI default; fallback **Africa’s Talking**.

## Discovery (C0)

- Communication module = PLAT-003 skeleton only.
- No outbox runtime yet (ADR-008 accepted conceptually).
- Guardian `phone` exists (ACF-010).
- Next freezes planned: **DBF-013** / **ACF-014**.

## Stop gate

Do **not** implement Beem HTTP client until Owner accepts COMMS-001.

## Next after Accept

COMMS-002 template catalog → DBF-013/ACF-014 → COMMS-003 Fake path → COMMS-004 Beem → COMMS-005 ledger/meter.
