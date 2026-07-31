# PAY-PROVIDER-001 — Payment provider decision

| Field     | Value                                      |
| --------- | ------------------------------------------ |
| Decision  | PAY-PROVIDER-001                           |
| Date      | 2026-07-21 (amended 2026-07-31)            |
| Program   | IMP-009 / EPIC-PAY-01                      |
| Authority | Solo-operator provisional (SOLO-GOV-001)   |
| Related   | **PAY-001** Accepted — ClickPesa (Zanzibar) |

## Decision

1. **CI and default local without secrets:** `FakePaymentProvider` only (`provider_code` = `fake`). ADR-011 port remains.
2. **Chosen real MVP vendor (lab → Zanzibar pilot path):** **ClickPesa** — opaque `provider_code` = `clickpesa`. Fallback vendor if onboarding blocked: **Selcom** (`selcom`).
3. **Parent rails messaging:** M-Pesa **and** Mixx (plus Airtel/Halo if ClickPesa exposes them) — not M-Pesa-only.
4. **No hard-coded MNO enums** in domain/ledger models — only opaque `provider_code` / `provider_ref` / gateway event ids.
5. **Vendor credentials** never in git; env / secrets manager only.
6. **Real adapter + signed webhook** require **PAY-002** contract + ACF-012.x before merge of production-shaped routes.
7. **Production/public pilot cutover** still blocked by readiness NO GO + privileged MFA residual — choosing ClickPesa does not waive that.

## Consequences

- Fake webhook path remains for dedupe/ledger tests.
- Gated ClickPesa adapter work is **allowed** under PAY-001 / PAY-002.
- Office cash/bank/cheque path unchanged.
- Until ClickPesa sandbox credentials exist, runtime stays on Fake even though the vendor **choice** is Accepted.
