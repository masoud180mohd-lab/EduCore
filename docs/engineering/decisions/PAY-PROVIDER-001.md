# PAY-PROVIDER-001 — Payment provider decision (provisional)

| Field     | Value                     |
| --------- | ------------------------- |
| Decision  | PAY-PROVIDER-001          |
| Date      | 2026-07-21                |
| Program   | IMP-009                   |
| Authority | Solo-operator provisional |

## Decision

Until a production sandbox contract is chosen (EduCore/46 Known Limitations):

1. **CI and local:** `FakePaymentProvider` only (ADR-011).
2. **No vendor** (M-Pesa, Mixx, etc.) credentials, SDKs, or hard-coded provider enums in domain models beyond opaque `provider_code` strings.
3. Real MoMo adapter requires a superseding brief with sandbox contract + signature verification spec.

## Consequences

- Webhook path may exist behind Fake events for dedupe/ledger tests.
- Production mobile-money cutover is **blocked**.
