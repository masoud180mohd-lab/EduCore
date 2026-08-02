# PAY-001 — MVP payment provider selection (decision brief)

| Field       | Value                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------- |
| Decision ID | `PAY-001`                                                                                   |
| Status      | **Accepted (solo-operator)** — 2026-07-31                                                   |
| Date        | 2026-07-31                                                                                  |
| Program     | EPIC-PAY-01 / `EduCore/39_ENGINEERING_EXECUTION_ROADMAP.md` PAY-001                         |
| Supersedes  | Provisional Fake-only posture in `PAY-PROVIDER-001` (when Accepted)                         |
| Authority   | Solo-operator provisional (SOLO-GOV-001) until countersigned                                |
| Governing   | ADR-011 · `20_PAYMENT_ACCOUNTING_BIBLE.md` · DBF-012 · ACF-012 · Constitution finance rules |

## Objective

Choose **one primary MVP mobile-money path** for Tanzania lab → pilot, so engineering can write a real provider adapter without inventing vendor contracts. Office cash/bank/cheque remains; Fake stays for CI.

Success for this decision (not full EPIC-PAY):

1. Named provider (or named aggregator + primary rail).
2. Named sandbox contract owner / how credentials will be obtained.
3. Explicit `provider_code` string(s) allowed in config (opaque; not domain enums).
4. Webhook security model chosen (signature / mTLS / shared secret) at least at “must-have” level.
5. Clear non-goals so MoMo work does not expand into cards/banks/control numbers.

## Zanzibar context (Project Owner constraint — 2026-07-31)

**Target launch geography:** Zanzibar, Tanzania (Unguja first; Pemba later as coverage allows).

### What matters for parents here

| Fact                                                                                                                              | Implication for EduCore                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Same national MNOs operate on Zanzibar (Vodacom, Yas/ex-Tigo, Airtel, Halotel) — not a separate wallet island                     | Mainland Tanzania payment APIs that cover those rails work for Zanzibar SIMs                              |
| Local coverage reports often rate **Yas** strong in Stone Town / north–west coasts; Vodacom remains nationwide + **M-Pesa** brand | A **single-rail** M-Pesa-only MVP would exclude many Yas/Mixx and Airtel households                       |
| National MoMo share (TCRA / BoT late-2025 reporting, approx.)                                                                     | M-Pesa ~41% · Mixx by Yas ~29–31% · Airtel Money ~18% · HaloPesa ~10% — Zanzibar schools inherit this mix |
| School fee UX in TZ commonly uses **control / BillPay numbers** over “open our app”                                               | Prefer aggregator BillPay / push-to-pay that parents already know from M-Pesa/Mixx menus                  |
| Office cash + bank still common for schools                                                                                       | Keep existing office payment path; MoMo is additive                                                       |

### Zanzibar-specific recommendation

| Field                     | Recommendation                                                                                                                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Option                    | **A — Aggregator first**                                                                                                                                                                                            |
| Provisional vendor        | **ClickPesa** (Accepted)                                                                                                                                                                                            |
| Why ClickPesa             | Documented **school BillPay / control-number** flow; rails include **M-Pesa, Mixx (Tigo Pesa), Airtel Money, HaloPesa** + CRDB; webhook + query APIs fit ADR-011 + bible (dedupe, reconcile independent of webhook) |
| Fallback vendor           | **Selcom** if ClickPesa sandbox/KYC is blocked for the Zanzibar entity                                                                                                                                              |
| Parent messaging          | “Lipa ada kwa **M-Pesa au Mixx** (na Airtel/Halo ikiwa inapatikana)” — not M-Pesa-only                                                                                                                              |
| Opaque `provider_code`    | `clickpesa` (or `selcom` if fallback)                                                                                                                                                                               |
| Rejected for Zanzibar MVP | **B alone** (M-Pesa Direct) or **C alone** (Mixx Direct) — too many parents left on the wrong rail                                                                                                                  |
| Still deferred            | Cards, multi-aggregator UI, production cutover without MFA + readiness re-review                                                                                                                                    |

**Honesty:** Vendor **choice** is Accepted under SOLO-GOV-001. Sandbox onboarding (business registration: Zanzibar vs mainland entity, BoT PSP relationship via aggregator) remains Project Owner / operator work before live webhook tests.

## Assumptions (correct now or stop)

1. Geography remains **Tanzania-first**, currency **TZS**, amount truth in **minor units**.
2. ADR-011 stands: orchestration + adapter; provider payloads do not leak into ledger core.
3. Existing port `PaymentProviderPort` + `payment_gateway_events` dedupe stay; we **add** an adapter, we do not rip Fake out of CI.
4. Parent/guardian **initiates** MoMo from fee UX later; bursar **office payment** already ships — MoMo is additive.
5. We do **not** yet have a signed vendor sandbox contract or live credentials in this repo.
6. MFA for finance admins is still required before **production** finance trust — choosing a provider does not waive that.
7. Kit readiness remains **NO GO** for unrestricted production; this decision enables **gated** adapter work only.

## Current baseline (repo)

| Piece                                 | State                                                                             |
| ------------------------------------- | --------------------------------------------------------------------------------- |
| `PAY-PROVIDER-001`                    | Amended: ClickPesa chosen; Fake default until secrets + adapter flag              |
| `FakePaymentProvider`                 | Still bound for CI / default local                                                |
| `POST /api/v1/payments/webhooks/fake` | AuthZ `finance.manage`; stores/dedupes events; does not complete pending attempts |
| Office methods                        | cash / bank / cheque / other via admin fees UI                                    |
| Ledger                                | DBF-012: receivable on issue; clearing/cash on collect; reversals only            |
| ClickPesa adapter                     | **Not implemented** — next = PAY-002                                              |

## Options

| ID    | Option                                                                                       | Pros                                                                                 | Cons                                                                                     |
| ----- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| **A** | **Aggregator first** (e.g. ClickPesa, Selcom, or equivalent TZ aggregator with sandbox docs) | One adapter; often covers M-Pesa + Mixx/Tigo + Airtel; faster multi-wallet parent UX | Fees/settlement opacity; aggregator lock-in; must verify webhook quality & TZ school KYC |
| **B** | **Vodacom M-Pesa Direct** as sole primary                                                    | Highest parent recognition; SRS “one primary provider” maps cleanly                  | Heavier onboarding; single rail; Mixx/Airtel parents left to office payment              |
| **C** | **Mixx by Yas (Tigo) Direct** as sole primary                                                | Already named in earlier provisional docs                                            | Smaller share than M-Pesa for many schools; same single-rail cost                        |
| **D** | **Defer real MoMo** (keep Fake + office only)                                                | Zero vendor risk now                                                                 | Does **not** satisfy PAY-001 or MVP MoMo requirement; only acceptable as explicit pause  |

### Engineering recommendation (Accepted)

**Option A + ClickPesa** for Zanzibar MVP. Primary parent rails **M-Pesa + Mixx**; opaque code `clickpesa`; Fake retained for CI.

Fallback: **Selcom** if ClickPesa cannot onboard the operator/school entity — same Option A, no architecture change.

## Decision record (Accepted 2026-07-31)

| Field                          | Value                                                                                                     |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Chosen option                  | **A**                                                                                                     |
| Legal / commercial vendor name | **ClickPesa** (fallback **Selcom** if onboarding blocked)                                                 |
| Opaque `provider_code`         | `clickpesa` (fallback `selcom`)                                                                           |
| Launch geography               | **Zanzibar, Tanzania** (Unguja first; Pemba later)                                                        |
| Sandbox owner (human)          | Project Owner / operator — merchant registration pending                                                  |
| Credential storage             | env / secrets manager only — never git                                                                    |
| Primary parent rail messaging  | **M-Pesa au Mixx** (Airtel/Halo if aggregator exposes)                                                    |
| Webhook auth (MVP)             | Provider-signed webhook (exact scheme locked in **PAY-002** against ClickPesa docs)                       |
| Settlement currency            | TZS                                                                                                       |
| Fake provider in CI            | **Retained** (`fake`)                                                                                     |
| Supersedes                     | `PAY-PROVIDER-001` Fake-only for **gated adapter work**; Fake remains default until env enables ClickPesa |

## Project Owner acceptance

- **2026-07-31:** Owner confirmed (“sawa”) Zanzibar path → Option **A + ClickPesa**.
- Sandbox credentials and legal entity (Zanzibar vs mainland registrant) remain **operator follow-ups** before live webhook tests — they do **not** reopen the vendor choice.

## Mandatory follow-on gates (after Accept — do not skip)

Ordered as roadmap EPIC-PAY-01:

| ID             | Output                                                                                                                 | Blocks coding?       |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------- |
| PAY-001 Accept | This document Status → Accepted + filled table                                                                         | Yes — adapter coding |
| PAY-002        | Adapter contract amend (initiate, query status, webhook verify, map to `PaymentProviderStatus`)                        | Yes                  |
| ACF-012.x      | Public webhook route (unauthenticated to EduCore session; **provider signature** required) + initiate MoMo attempt API | Yes                  |
| DBF-012.x      | Only if new columns needed (prefer none; opaque codes already exist)                                                   | If schema change     |
| PAY-003…005    | Lifecycle, webhook ingest, reconciliation job                                                                          | Implementation       |
| DSF-004/005.x  | Parent/admin MoMo status UX (no Fake webhook console required for MVP)                                                 | UI                   |
| Tests          | Duplicate webhook, amount mismatch, delayed callback, ledger balance — bible mandatory                                 | Release of adapter   |

## Non-goals (PAY-001 / early EPIC-PAY)

- Cards, bank transfer APIs, government control numbers.
- Multi-provider runtime switching UI for school admins.
- Refunds/disputes beyond existing reversal patterns.
- Replacing office cash/bank path.
- Production cutover or real school money without readiness re-review + MFA path.
- Committing vendor secrets or hard-coding MNO enums into domain models.

## Doubt checks

| Doubt                                           | Response                                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Can we code M-Pesa now without a vendor?        | **No** — that recreates Fake with a lying name.                                                  |
| Does aggregator violate “one primary provider”? | No — one **orchestration primary**; Zanzibar messaging is dual-rail (M-Pesa + Mixx).             |
| Why not M-Pesa-only on Zanzibar?                | Yas/Mixx locally strong; ~30% national Mixx share — single rail loses too many parents.          |
| Will Fake webhooks remain?                      | Yes for CI; real webhook path must not require `finance.manage` session auth.                    |
| Amount trust?                                   | Never trust client/provider amount blindly — match attempt + invoice; mismatch → reconcile fail. |

## Next step

**PAY-002** — ClickPesa adapter contract (initiate / BillPay, status query, webhook verify, map to `PaymentProviderStatus`). Do not ship vendor SDK until PAY-002 + ACF-012.x accept.
