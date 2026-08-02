# PAY-002 — ClickPesa adapter contract

| Field     | Value                                                              |
| --------- | ------------------------------------------------------------------ |
| Program   | **PAY-002** / EPIC-PAY-01                                          |
| Date      | 2026-07-31                                                         |
| Status    | **Accepted** (solo-operator)                                       |
| Contract  | `docs/engineering/decisions/PAY-002-clickpesa-adapter-contract.md` |
| Depends   | PAY-001 Accepted (ClickPesa / Zanzibar)                            |
| Next      | **PAY-003** client + port (Fake remains default)                   |
| Authority | Solo-operator provisional (SOLO-GOV-001)                           |

## Goal

Specify ClickPesa adapter boundary before coding.

## Done

- [x] Adapter contract (BillPay Order, JWT auth, HMAC-SHA256 checksum, status/amount maps, env allowlist, test plan)
- [x] ACF-012 companion note (rev preview for MoMo webhook + initiate)
- [x] Status / limitations / CHANGELOG sync
- [ ] PAY-003 implementation (out of this task)

## Non-goals

Nest adapter, parent UI, production cutover.
