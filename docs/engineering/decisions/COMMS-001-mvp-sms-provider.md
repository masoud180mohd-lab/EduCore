# COMMS-001 — MVP SMS provider selection (decision brief)

| Field       | Value                                                                                          |
| ----------- | ---------------------------------------------------------------------------------------------- |
| Decision ID | `COMMS-001`                                                                                    |
| Status      | **Proposed** — awaiting Project Owner “sawa” (solo-operator)                                   |
| Date        | 2026-08-03                                                                                     |
| Program     | EPIC-COMMS-01 / `EduCore/39_ENGINEERING_EXECUTION_ROADMAP.md` COMMS-001                        |
| Authority   | Solo-operator provisional (SOLO-GOV-001) until countersigned                                   |
| Governing   | ADR-008 (outbox) · SRS SMS-first · Constitution async rules · Architecture Communication BC    |

## Objective

Choose **one primary MVP SMS vendor** for Tanzania lab → pilot so engineering can implement `SmsProviderPort` without inventing a vendor. **Fake remains CI/default**. WhatsApp / email / push stay out of this epic.

Success for this decision (not full EPIC-COMMS):

1. Named vendor + opaque `provider_code`.
2. Named sandbox / account owner (human).
3. Env var allowlist (no secrets in git).
4. Delivery-report (DLR) posture at “must-have” level.
5. Explicit fallback if onboarding fails.
6. Clear non-goals (no WhatsApp, no marketing blasts).

## Assumptions (correct now or stop)

1. Geography **Tanzania-first** (Zanzibar schools same national MNO SIMs: Vodacom, Yas, Airtel, Halotel).
2. Channel MVP = **SMS only**; kit: SMS before WhatsApp.
3. Recipients come from **guardian.phone** (or validated E.164 later) — no free-text blast lists in v1.
4. Critical send path uses **transactional outbox** (ADR-008); outbox table may be implemented in this epic if missing.
5. Variable SMS cost must be **metered per tenant**; daily cap in config; Fake unlimited for CI but still writes delivery rows.
6. We do **not** yet have vendor sandbox credentials in this repo.
7. Kit readiness remains **NO GO** for unrestricted production; this decision enables **gated** adapter work only.
8. PAY-OPS-001 (ClickPesa sandbox) stays **deferred** — do not reopen as default work.

## Current baseline (repo)

| Piece | State |
| ----- | ----- |
| `apps/api/src/modules/communication/**` | PLAT-003 skeleton only (`ready: false`) |
| Outbox runtime | **Not implemented** — ADR-008 accepted; tables conceptual in kit DB design |
| Guardian `phone` | Exists (ACF-010 / DBF-010); optional ≤32; no E.164 yet |
| `SmsProviderPort` | **Does not exist** |
| Next freezes (planned) | **DBF-013** · **ACF-014** after COMMS-001 Accept |

## Options compared (≥2 TZ-capable)

| ID | Vendor | Pros | Cons |
| -- | ------ | ---- | ---- |
| **A** | **Beem Africa** | Strong TZ footprint; published **TZS** tier pricing; REST send (`apisms.beem.africa`); Basic auth; DLR/API docs; Sender ID path familiar to TZ schools | Lab “sandbox” less famous than AT; Sender ID / TCRA registration needed before production alphanumeric ID |
| **B** | **Africa’s Talking** | Excellent developer sandbox; pan-African APIs; good docs/SDKs; future USSD/voice optionality | TZ pricing/routing often less “local-first” than Beem for pure TZ schools; wallet/currency ops may be KE-centric for some accounts |
| **C** | **Twilio** | Best global DX; mature DLR/webhooks | Higher TZ cost via aggregated routes; overkill for SMS-only TZ MVP; FX/billing friction for TZS schools |
| **D** | **Defer real SMS** (Fake only) | Zero vendor risk | Does **not** satisfy EPIC-COMMS MVP; only OK as explicit pause |

### Engineering recommendation (Proposed)

**Option A — Beem Africa** for Zanzibar / Tanzania school SMS MVP.

| Why Beem | Detail |
| -------- | ------ |
| Fit | Transactional school alerts (fees, attendance) to guardian MSISDNs on national MNOs |
| Cost honesty | Public TZ per-SMS tiers (order ~TZS 10–20/msg by volume — **verify at signup**; meter in EduCore regardless) |
| Adapter shape | Single HTTP send + optional DLR callback — mirrors payments Fake→vendor env gate |
| Fallback | **Africa’s Talking** if Beem account/Sender ID blocked for the operator entity — same port, different `provider_code` |

**Reject for MVP:** Twilio (cost/complexity); multi-vendor UI; WhatsApp “quickly.”

## Decision record (fill on Accept)

| Field | Proposed value |
| ----- | -------------- |
| Chosen option | **A — Beem Africa** |
| Opaque `provider_code` | `beem` (fallback `africas_talking`) |
| Fake in CI | **Retained** — `SMS_PROVIDER=fake` (default) |
| Launch geography | Tanzania (Zanzibar schools first; mainland SIMs OK) |
| Sandbox / account owner | Project Owner / operator — registration pending |
| Credential storage | env / secrets manager only — **never git** |
| Env allowlist (proposed) | `SMS_PROVIDER`=`fake`\|`beem` (later `africas_talking`); `BEEM_API_KEY`; `BEEM_SECRET_KEY`; `BEEM_SOURCE_ADDR` (Sender ID); optional `BEEM_BASE_URL` default `https://apisms.beem.africa`; optional `SMS_DAILY_CAP_PER_TENANT` |
| DLR / webhook (MVP) | Prefer Beem delivery reports → EduCore public callback with shared-secret or signed check — **exact scheme locked in COMMS-004 contract** after Accept; interim may complete on HTTP 2xx send ack + async DLR |
| Phone format to vendor | E.164 digits without `+` (e.g. `2557…`) — normalize in adapter; reject unparseable guardian phones |
| Metering | Increment tenant usage on **accepted send** (and optionally on DLR delivered); Fake still increments for lab honesty |
| Daily cap | Configured per tenant (default lab high); Fake bypasses **cost** but not delivery rows |

## Binding rules (after Accept)

1. Nest binds `SMS_PROVIDER_PORT` → `FakeSmsProvider` unless `SMS_PROVIDER=beem` **and** Beem secrets present (mirror payments ClickPesa gate).
2. No Nest product routes until **DBF-013 + ACF-014** Accepted (provisional SOLO-GOV-001 OK).
3. No hard-coded Beem SDK until this brief Status → **Accepted**.
4. Template bodies only; unknown placeholders rejected.
5. Logs: phone **last-4** only; never full phone + full body at info level.

## Mandatory follow-on (do not skip)

| ID | Output | Blocks |
| -- | ------ | ------ |
| COMMS-001 Accept | This doc Status → Accepted | Real vendor client |
| COMMS-002 | Template catalog (en/sw stubs) | Seeded templates |
| DBF-013 / ACF-014 | Schema + HTTP freeze | Product Nest routes |
| COMMS-003 | Notification request + outbox enqueue | End-to-end Fake |
| COMMS-004 | Beem adapter behind env | Live SMS |
| COMMS-005 | Delivery ledger + meter | Support / cost honesty |

## Non-goals

- WhatsApp, email, push
- Marketing / school-wide blast without caps
- AI-generated message bodies
- Resuming ClickPesa PAY-OPS-001 as default parallel work
- Claiming production SMS without MFA + readiness gates

## Project Owner acceptance

- **Pending:** Reply **“sawa”** (or amend: Africa’s Talking first / defer) before COMMS-003 real-vendor coding.
- Registration for Beem account + Sender ID remains operator work (like ClickPesa keys) — does **not** reopen choice once Accepted unless onboarding fails → fallback AT.

## Solo-operator honesty

Proposed under acting seats only. Vendor pricing and DLR details must be re-checked against Beem docs at COMMS-004 contract time.
