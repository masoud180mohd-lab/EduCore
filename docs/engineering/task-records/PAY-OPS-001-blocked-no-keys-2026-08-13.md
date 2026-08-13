# PAY-OPS-001 — blocked 2026-08-13 (no ClickPesa keys)

| Field | Value |
| --- | --- |
| Date | 2026-08-13 |
| Status | **Still deferred** |
| Runtime | Fake (`PAYMENT_PROVIDER=fake`) |
| Authority | SOLO-GOV-001 honesty; Owner asked to run PAY-OPS |

## Check (names / presence only)

| Config | `CLICKPESA_*` present | `PAYMENT_PROVIDER` |
| --- | --- | --- |
| Doppler `educore`/`stg` | **no** | present (Fake path) |
| Doppler `educore`/`prd` | **no** | `fake` |
| `npm run payments:check-config` (via `prd`) | missing `CLICKPESA_CLIENT_ID`, `CLICKPESA_API_KEY`, `CLICKPESA_CHECKSUM_KEY` | `requestedProvider: fake` → `effectiveProvider: fake` |

## Honesty

- Owner authorized PAY-OPS; **keys were not invented** and were not pasted into chat.
- Malipo yanabaki **Fake** hadi ClickPesa sandbox credentials ziwekwe kwenye Doppler (si git, si chat).
- Resume `PAY-OPS-001-clickpesa-sandbox-pilot.md` when keys exist; then set `PAYMENT_PROVIDER=clickpesa` only after `payments:check-config` reports `effectiveProvider: clickpesa`.
