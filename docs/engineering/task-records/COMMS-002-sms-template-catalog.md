# COMMS-002 — SMS template catalog

| Field     | Value                                      |
| --------- | ------------------------------------------ |
| Program   | **COMMS-002** / EPIC-COMMS-01              |
| Date      | 2026-08-03                                 |
| Status    | **Done** (solo-operator)                   |
| Depends   | COMMS-001 Accepted                         |
| Catalog   | `docs/engineering/communication/SMS_TEMPLATE_CATALOG.md` |
| Authority | Solo-operator provisional (SOLO-GOV-001)   |

## Delivered

- Codes: `fee_invoice_issued`, `payment_received`, `payment_momo_pending`, `attendance_absent_digest`, `comms_test_sms`
- Locales: `en` + `sw` stubs; placeholder allowlists; length guidance
- v1 trigger: **manual/admin notify** first (not auto domain events)

## Next

**COMMS-F0/F1** — DBF-013 + ACF-014 freezes for notifications.
