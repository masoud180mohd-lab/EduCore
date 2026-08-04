# AI-004 — AI usage metering harden

| Field     | Value                                                       |
| --------- | ----------------------------------------------------------- |
| Program   | **AI-004** / EPIC-AI-01 / F-AI-01 metering                  |
| Date      | 2026-08-03                                                  |
| Status    | **Done** (solo-operator provisional)                        |
| Depends   | AI-002 · AI-003 (`lab.echo` seed) · ACF-AI-001 · DBF-AI-001 |
| Authority | Solo-operator provisional (SOLO-GOV-001)                    |
| Mirror    | COMMS-005 delivery ledger + meter                           |

## Gaps vs AI-002 (fixed)

| Gap                                               | Fix                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------ |
| GET usage totals incomplete vs ACF “token fields” | Added `inputTokensTotal`, `outputTokensTotal`, `estimatedCostMinorTotal` |
| Cap meter read fail-opened (`sum` → 0 on error)   | Fail closed → `meter_unavailable` / no success meter                     |
| Weak calendar date parse (`2026-02-31`)           | Round-trip UTC validation in `parseAiUsageDate`                          |
| Thin tests / no manual QA                         | Unit + lab mapping tests; `AI-004-manual-qa.md`                          |
| Cap semantics under-documented                    | ACF/DBF v1.1 + policy below                                              |

## Metering policy (exact)

1. **Success meter bump** only when invoke settles `status=succeeded` with `countUsage=true`. SQL `app.ai_complete_invoke` also requires `p_count_usage AND p_status = 'succeeded'`.
2. **No success meter** for: `disabled` (kill switch / provider disabled), `rejected` (gate, unknown vars, prompt missing, **daily_cap**), `failed` (provider / persist / **meter_unavailable**).
3. Invoke **rows may still persist** for rejected/disabled (audit) without incrementing `ai_usage_daily`.
4. Cap = **tenant-wide** `SUM(request_count)` for UTC date across all `featureCode`s. Default cap 100; bypass via `AI_BYPASS_DAILY_CAP=true` (cap not enforced; meters still increment; API `bypassDailyCap=true`, `dailyCap=null`).
5. Upsert is **atomic** (`ON CONFLICT DO UPDATE`) — concurrent successes do not lose increments.
6. Cap check is **check-then-act** before Fake provider; modest parallel lab traffic may overshoot by concurrency (honest lab limit).

## Delivered

- `ai-usage.ts` helpers + tests
- Fail-closed meter read in repository + gateway
- GET `/api/v1/ai/usage` totals + platform/bypass flags
- ACF-AI-001 **v1.1** / DBF-AI-001 **v1.1** honesty patches
- Manual QA checklist

## Non-goals

- Admin AI usage UI
- Billing / real provider cost APIs
- Per-user budgets
- AI-005 eval / AI-006 real providers

## Next

**AI-005** evaluation harness (spec + Fake fixtures), or stop until `GO AI-005`.
