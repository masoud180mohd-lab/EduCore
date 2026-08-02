# PAY-002 — ClickPesa adapter contract

| Field       | Value                                                                             |
| ----------- | --------------------------------------------------------------------------------- |
| Decision ID | `PAY-002`                                                                         |
| Status      | **Accepted (solo-operator)** — 2026-07-31                                         |
| Date        | 2026-07-31                                                                        |
| Program     | EPIC-PAY-01                                                                       |
| Depends     | PAY-001 Accepted (ClickPesa / Zanzibar)                                           |
| Authority   | Solo-operator provisional (SOLO-GOV-001)                                          |
| Governing   | ADR-011 · PAY-PROVIDER-001 · `20_PAYMENT_ACCOUNTING_BIBLE.md` · DBF-012 · ACF-012 |
| Vendor docs | https://docs.clickpesa.com (fetched 2026-07-31)                                   |

## Objective

Define the **ClickPesa adapter boundary** for EduCore before Nest coding (PAY-003/004): how we initiate collection, verify webhooks, query status, map amounts/statuses, and store gateway events — without leaking vendor payloads into the ledger.

## MVP collection mode (locked)

| Choice                     | Decision                                                                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primary UX                 | **Order BillPay Control Number** per payment attempt (one invoice payment → one control number parents pay via M-Pesa / Mixx / Airtel / Halo / CRDB) |
| API                        | `POST https://api.clickpesa.com/third-parties/billpay/create-order-control-number`                                                                   |
| Auth                       | JWT from `POST /third-parties/generate-token` using `client-id` + `api-key` headers (token ~1h)                                                      |
| Deferred (not PAY-002 MVP) | USSD Push, Hosted Checkout, Card, Customer BillPay (static per student), payouts, deposits                                                           |

**Rationale:** Matches fee invoice lifecycle; BillPay is the school-friendly path from PAY-001; application webhooks apply when control numbers are created via API.

## Amount units (critical)

| System                                                     | Unit                                                         |
| ---------------------------------------------------------- | ------------------------------------------------------------ |
| EduCore (DBF-012 / ACF-012)                                | Integer **minor** units; `TZS_MINOR_SCALE = 100`             |
| ClickPesa BillPay `billAmount` / webhook `collectedAmount` | Treated as **major TZS** (docs examples: `90900`, `"10000"`) |

**Adapter rule:**

- Outbound: `billAmount = amountMinor / 100` — only when `amountMinor % 100 === 0`; otherwise **reject** initiate (no fractional TZS cents in ClickPesa MVP).
- Inbound: `eventAmountMinor = round(Number(collectedAmount) * 100)` — must be safe integer > 0.
- Always compare inbound `eventAmountMinor` to `payment_attempts.amount_minor` before posting success; mismatch → reconcile outcome `amount_mismatch`, **do not** post ledger.

If sandbox proves ClickPesa already sends minor units, amend this contract before coding — do not guess in implementation.

## Opaque identity mapping

| EduCore field                     | ClickPesa field                                | Notes                                                           |
| --------------------------------- | ---------------------------------------------- | --------------------------------------------------------------- |
| `provider_code`                   | constant `clickpesa`                           | Never MNO enum                                                  |
| `payment_attempts.id` (ULID/UUID) | `billReference` / correlation `orderReference` | Idempotent create; 409 if reference reused                      |
| `provider_ref`                    | `billPayNumber` from create response           | What parent pays                                                |
| `provider_event_id`               | webhook/query `data.id`                        | Dedupe key with `(tenant_id, provider_code, provider_event_id)` |
| Secondary                         | `paymentReference`                             | Store in raw payload / optional metadata — not ledger FK        |

Store raw webhook body (redacted if needed) + `payload_sha256` as today; ledger only sees attempt + mapped status/amount.

## Port shape (PAY-003 implement)

Extend beyond today’s `initiate`-only Fake port:

```ts
// Conceptual — implement in apps/api under providers/; do not put ClickPesa types in domain/
interface PaymentProviderPort {
  readonly providerCode: 'fake' | 'clickpesa'; // runtime string; domain still opaque text
  initiate(input: PaymentProviderInitiateInput): Promise<PaymentProviderResult>;
  /** Optional for Fake; required for ClickPesa reconcile/jobs */
  queryStatus?(providerOrderRef: string): Promise<PaymentProviderResult>;
}

type PaymentProviderInitiateInput = {
  tenantId: string;
  invoiceId: string;
  amountMinor: number;
  currency: 'TZS';
  reference: string; // payment_attempt.id
  description?: string; // billDescription
};

type PaymentProviderResult = {
  providerCode: string;
  providerRef: string; // billPayNumber
  status: 'pending' | 'succeeded' | 'failed';
  /** ClickPesa order/bill reference we sent (= attempt id) */
  orderReference?: string;
};
```

**Initiate behavior (ClickPesa):**

1. Ensure JWT (cache until ~50m).
2. `POST /billpay/create-order-control-number` with:
   - `billAmount` = major TZS
   - `billPaymentMode` = `EXACT` for MVP (partials = later; office path already covers cash partials)
   - `billReference` = `input.reference` (attempt id)
   - `billDescription` = short invoice label (no child PII beyond necessary school bill text)
3. On 200: return `{ providerCode: 'clickpesa', providerRef: billPayNumber, status: 'pending', orderReference: reference }`.
4. On 409 conflict: treat as idempotent recovery — query BillPay details / payments by order reference; do not create a second attempt row.
5. Network/5xx: leave attempt `pending`/`failed` per payments service rules; no ledger post.

Binding: `PAYMENT_PROVIDER_PORT` → Fake when `PAYMENT_PROVIDER=fake` (default); ClickPesa when `PAYMENT_PROVIDER=clickpesa` **and** secrets present.

## Status mapping

### ClickPesa payment statuses → EduCore `PaymentProviderStatus`

| ClickPesa               | EduCore provider status | Ledger / attempt                                              |
| ----------------------- | ----------------------- | ------------------------------------------------------------- |
| `PENDING`               | `pending`               | No post                                                       |
| `PROCESSING`            | `pending`               | No post                                                       |
| `ON-HOLD`               | `pending`               | No post; flag for bursar (reconcile later)                    |
| `SUCCESS`               | `succeeded`             | Eligible to complete attempt + journal **after** amount match |
| `SETTLED`               | `succeeded`             | Same as SUCCESS if not already posted (idempotent)            |
| `FAILED`                | `failed`                | Mark attempt failed; no revenue cash post                     |
| `REFUNDED` / `REVERSED` | out of MVP auto-path    | Manual reverse / reconcile; do not auto-post                  |

### Webhook events (MVP subscribe)

| Event                   | Action                                                                                                     |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| `PAYMENT RECEIVED`      | Verify checksum → dedupe by `data.id` → map SUCCESS → amount check → complete pending mobile_money attempt |
| `PAYMENT FAILED`        | Verify → dedupe → map failed                                                                               |
| Payout / Deposit events | **Ignore** (204/200 ack only)                                                                              |

Configure **Application webhooks** (not only merchant) so BillPay API-created numbers callback to EduCore.

## Webhook auth (locked)

From ClickPesa checksum docs:

1. Payload may include `checksum` + `checksumMethod`.
2. **Exclude** those two fields, recursively sort object keys, `JSON.stringify` compact, **HMAC-SHA256** with checksum key, hex digest.
3. Compare to received `checksum` (timing-safe).
4. Reject **401/403** (or 400) if missing/invalid when checksum is enabled for the merchant — **MVP requires checksum enabled**.

**EduCore route (ACF-012.x):**

| Method | Path                                  | AuthZ                                                                     |
| ------ | ------------------------------------- | ------------------------------------------------------------------------- |
| POST   | `/api/v1/payments/webhooks/clickpesa` | **No** session Bearer; **checksum** required; optional IP allowlist later |

Respond **2xx** quickly after durable accept (dedupe insert); process completion synchronously in v1 if fast, else outbox — must not double-post ledger.

Tenant resolution: from `orderReference` / `billReference` → `payment_attempts.id` → `tenant_id` (RLS). Do **not** trust client-supplied tenant headers on this route.

## Query (reconcile independence)

`GET https://api.clickpesa.com/third-parties/payments/{orderReference}`

- `orderReference` = payment attempt id used at initiate.
- Use in PAY-005 reconcile job and bursar “refresh status”.
- Map statuses with the same table as webhooks.
- Amount from `collectedAmount` → minor via ×100 rule.

## Env allowlist (never git)

| Variable                    | Purpose                                              |
| --------------------------- | ---------------------------------------------------- |
| `PAYMENT_PROVIDER`          | `fake` \| `clickpesa` (default `fake`)               |
| `CLICKPESA_BASE_URL`        | default `https://api.clickpesa.com/third-parties`    |
| `CLICKPESA_CLIENT_ID`       | Application client id                                |
| `CLICKPESA_API_KEY`         | Application API key                                  |
| `CLICKPESA_CHECKSUM_KEY`    | HMAC key for webhook + outbound checksum if required |
| `CLICKPESA_WEBHOOK_ENABLED` | `true` only when public URL configured               |

No vendor secrets in `.env.example` values — placeholders only.

## Failure modes

| Case                               | Behavior                                                           |
| ---------------------------------- | ------------------------------------------------------------------ |
| Bad checksum                       | Reject; no DB write                                                |
| Duplicate `provider_event_id`      | Return duplicate ack; no second ledger post                        |
| Amount mismatch                    | Record gateway event + reconcile `amount_mismatch`; **no** succeed |
| Currency ≠ TZS                     | Reject                                                             |
| Unknown orderReference             | 404/ignore with metric; do not create orphan payment               |
| Token expired                      | Refresh JWT; retry once                                            |
| Partial payment under `EXACT` mode | Should not occur; if webhook amount < attempt → mismatch path      |

## Test plan (bible-aligned — PAY-003/004)

| Test                                           | Expect                                          |
| ---------------------------------------------- | ----------------------------------------------- |
| Checksum valid / tampered                      | accept / reject                                 |
| Duplicate webhook same `data.id`               | second insert `duplicate=true`; one ledger post |
| Amount mismatch                                | no succeed; reconcile row                       |
| Delayed `PAYMENT RECEIVED` after query SUCCESS | idempotent complete                             |
| `PAYMENT FAILED`                               | attempt failed; no cash journal                 |
| Fake still default in CI                       | no network; existing Fake tests green           |
| Initiate rejects non-divisible-by-100 minor    | validation error                                |

## ACF-012.x preview (freeze amend — implement with PAY-004)

| Method | Path                                  | Notes                                                                                                                     |
| ------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/v1/payments/mobile-money`       | finance.manage + Idempotency-Key; creates attempt `method=mobile_money`, calls provider.initiate, returns `billPayNumber` |
| POST   | `/api/v1/payments/webhooks/clickpesa` | public + checksum                                                                                                         |
| GET    | `/api/v1/payments/{id}`               | already exists — include `providerRef` when present                                                                       |

Exact OpenAPI patch lands with implementation PR; this contract is binding for field semantics.

## Non-goals

- Selcom adapter (fallback only if PAY-001 fallback triggered).
- Parent UI (DSF-005.x later).
- Completing Fake webhook → pending succeed path beyond today’s store/dedupe (separate if needed).
- Production pilot / real school money without MFA + readiness re-review.

## Doubt checks

| Doubt                                  | Response                                                                            |
| -------------------------------------- | ----------------------------------------------------------------------------------- |
| Are ClickPesa amounts major or minor?  | Docs examples look major; locked as major + ×100 with sandbox amend gate            |
| Why not USSD Push first?               | BillPay matches school fee habits + multi-rail; Push can be Wave 2 behind same port |
| Session auth on webhook?               | Forbidden — checksum only                                                           |
| Leak ClickPesa `customer` into ledger? | No — gateway event payload only                                                     |

## Next

**PAY-003** — ClickPesa client + port implementation (still Fake default).  
**PAY-004** — Webhook route + attempt completion + ACF-012.x.  
**PAY-005** — Reconciliation job using query API.
