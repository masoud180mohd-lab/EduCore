# F-008: Live write isolation (attendance / marks / invoice / webhook)

## Outcome

Close Board finding **F-008**: isolation suites proved **reads** (and F-016 SELECT RLS) but not **writes**. A member of tenant A must not insert or complete tenant B rows via table DML or SECURITY DEFINER helpers.

## Status

Complete for SQL write isolation on the four named surfaces. HTTP write isolation remains covered indirectly by AuthZ + membership helpers; this suite is the DB evidence the Board asked for.

## Coverage

| Surface    | Direct INSERT as `educore_app`  | Cross-tenant helper                                                                                             |
| ---------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Attendance | `attendance_sessions` denied    | `create_attendance_session` with tenant B → 42501; class B under tenant A → 22023                               |
| Marks      | `marks` denied                  | `upsert_marks` with tenant B → 42501                                                                            |
| Invoice    | `invoices` denied               | `create_invoice_draft` tenant B → 42501; `issue_invoice` tenant A + invoice B → P0002                           |
| Webhook    | `payment_gateway_events` denied | `create_pending_mobile_money_attempt` tenant B → 42501; `ingest_clickpesa_gateway_event` as app → 42501 (F-017) |

## Files

- `tests/isolation/product-writes.live.test.ts`
- `tests/tooling/f008-write-isolation.test.ts`

## Verification

```bash
npx vitest run tests/tooling/f008-write-isolation.test.ts tests/isolation/product-writes.live.test.ts
```
