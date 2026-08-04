# Manual QA — AI-004 usage metering

Audience: staff with `ai.read` / `ai.manage`. Default provider = Fake (`AI_PROVIDER=fake`). No school-facing AI UI.

Prereqs: migrations through AI gateway + prompt registry (`20260803160000` / `20260803170000`); session + `X-Tenant-Id`; platform enabled.

## Happy path (Fake meter)

1. Note today’s UTC date: `date -u +%Y-%m-%d` (or use response `usageDate`).
2. `GET /api/v1/ai/usage` → `requestCountTotal` baseline `B` (often 0); note `dailyCap`, `bypassDailyCap`, `platformEnabled`.
3. `POST /api/v1/ai/lab/invoke` body:
   `{ "featureCode": "lab.echo", "promptCode": "lab.echo", "locale": "en", "variables": { "message": "meter-1" } }`
4. Expect `data.status=succeeded`, `providerCode=fake`, `usage.inputTokens` ≥ 1, `estimatedCostMinor=0`.
5. Repeat invoke once more (`message`: `meter-2`).
6. `GET /api/v1/ai/usage` → `requestCountTotal >= B+2`; row for `lab.echo` with matching tokens; **no** API keys / raw PII fields.
7. `GET /api/v1/ai/usage?featureCode=lab.echo` → same feature row(s); unknown feature → empty rows / total 0.
8. `GET /api/v1/ai/usage?date=2020-01-01` → totals 0 (or historical if any).
9. `GET /api/v1/ai/usage?date=2026-02-31` → **400**.

## Cap / bypass

1. Set `AI_BYPASS_DAILY_CAP` unset/false; `AI_DAILY_CAP_PER_TENANT=1` (restart API).
2. Ensure today’s meter for tenant is 0 (or use a fresh lab tenant).
3. First lab invoke → succeeded; `GET .../usage` → `requestCountTotal=1`, `dailyCap=1`, `bypassDailyCap=false`.
4. Second lab invoke → **409** `CONFLICT` / daily cap; usage stays **1**.
5. Set `AI_BYPASS_DAILY_CAP=true` (restart); `GET .../usage` → `bypassDailyCap=true`, `dailyCap=null`.
6. Further invokes succeed; usage continues to increase above prior cap.

## Kill switch

1. Set `AI_PLATFORM_ENABLED=false` (restart).
2. Lab invoke → **200** with `data.status=disabled` (no success output).
3. `GET .../usage` → `platformEnabled=false`; `requestCountTotal` unchanged vs pre-disable success total.

## AuthZ / honesty

1. Without `ai.read` → 403 on usage / prompts / get invoke.
2. Without `ai.manage` → 403 on lab invoke.
3. Responses never include provider secrets or unredacted child PII prompts.

## Out of scope this QA

- Real OpenAI/Anthropic
- Admin usage charts UI
- AI-005 eval fixtures
