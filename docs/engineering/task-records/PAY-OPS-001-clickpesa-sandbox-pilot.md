# PAY-OPS-001 — ClickPesa sandbox pilot (operator)

| Field     | Value                          |
| --------- | ------------------------------ |
| Program   | **PAY-OPS-001** (post PAY-006) |
| Date      | 2026-08-02                     |
| Status    | **Deferred** (skipped 2026-08-03 — resume when keys exist) |
| Depends   | PAY-001…PAY-006 Done on `main` |
| Authority | Solo-operator (SOLO-GOV-001)   |

## Goal

Prove bursar MoMo path against **ClickPesa sandbox** on a local/lab stack: initiate → BillPay → webhook and/or Refresh → succeeded receipt — without committing secrets.

**Deferral note (2026-08-03):** Operator chose to skip until ClickPesa sandbox credentials are available. Product code (PAY-001…006) remains on `main` with Fake default. Resume this checklist when keys exist; do not invent credentials.

## Non-goals

- Production KYC / live merchant cutover
- Parent portal pay UI
- Enabling ClickPesa in CI
- Committing `.env` with credentials

## Prerequisites

1. Local Postgres up (`npm run docker:up` or DEV-001).
2. App DB roles + admin seed working (`db:migrate`, `db:bootstrap-roles`, `seed:admin`).
3. ClickPesa **sandbox** application: Client ID, API key, checksum key (from vendor portal — never paste into chat/git).

## Env (local `.env` only)

Copy from `.env.example`, then set in **local** `.env` (gitignored):

```text
PAYMENT_PROVIDER=clickpesa
CLICKPESA_BASE_URL=https://api.clickpesa.com/third-parties
CLICKPESA_CLIENT_ID=…
CLICKPESA_API_KEY=…
CLICKPESA_CHECKSUM_KEY=…
```

Verify without printing secrets:

```bash
npm run payments:check-config
```

Expect `effectiveProvider: clickpesa`. Exit code 1 means `PAYMENT_PROVIDER=clickpesa` but secrets incomplete.

Restart Nest after env change. Fake remains default if any secret is empty.

### Webhooks (optional for first pass)

Refresh from provider works **without** a public URL. For webhook proof:

1. Expose Nest (`:3000`) with a tunnel (e.g. Cloudflare Tunnel / ngrok).
2. In ClickPesa portal, set Application webhook to  
   `https://<tunnel>/api/v1/payments/webhooks/clickpesa`
3. Ensure checksum key matches `CLICKPESA_CHECKSUM_KEY`.

## Migration

```bash
npm run db:migrate
```

Confirm `20260802150000_finance_clickpesa_momo` applied (helpers: `create_pending_mobile_money_attempt`, `ingest_clickpesa_gateway_event`).

## Manual QA script

1. Sign in as bursar/owner with `finance.manage` + `finance.reconcile`.
2. Open an **issued** / **partially_paid** invoice with balance > 0.
3. **Request mobile money** (whole TZS; amount ≤ balance).
4. Expect pending attempt + **BillPay** number (mono). Ask sandbox payer / vendor tool to pay that number.
5. Either:
   - Wait for webhook to `POST /api/v1/payments/webhooks/clickpesa` (HMAC), or
   - Click **Refresh from provider** on the pending row.
6. Expect status → succeeded (or honest still_pending / mismatch banner); invoice balance updates from API.
7. Confirm **Reconcile** still compare-only (does not replace Refresh).
8. Negative: unset secrets / `PAYMENT_PROVIDER=fake` → Request/Refresh show Fake honesty banner (no fake success).

## Pass criteria

| Check                         | Pass |
| ----------------------------- | ---- |
| MoMo initiate returns BillPay | ☐    |
| Refresh or webhook completes  | ☐    |
| Ledger/receipt via API only   | ☐    |
| Secrets not in git            | ☐    |
| CI still Fake default         | ☐    |

## After pass

- Mark this record **Done** (date + who).
- Update `EduCore/43_PROJECT_STATUS.md` next milestone (EPIC-COMMS or readiness re-review).
- Do **not** claim production MoMo without MFA + readiness gates.
