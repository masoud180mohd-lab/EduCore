# AI Evaluation Harness (AI-005)

| Field     | Value                                              |
| --------- | -------------------------------------------------- |
| ID        | `AI_EVAL_HARNESS`                                  |
| Version   | `1.0`                                              |
| Date      | 2026-08-04                                         |
| Program   | **EPIC-AI-01** / **AI-005** / F-AI-03              |
| Gate link | `AI_FEATURE_GATE.md` checklist item 7              |
| Authority | Solo-operator provisional (SOLO-GOV-001)           |

**Honesty:** Skeleton harness for **Fake** provider only. Not a production LLM judge, bias suite, or human-acceptance UI.

## Purpose

Provide a repeatable **fixture → invoke → assert** pattern so every allowlisted `featureCode` can prove:

- happy path through `AiGatewayPort`
- gate / kill-switch / cap failures
- redaction stub behaviour (`redactForAi`)

Before adding a product `featureCode` to the runtime allowlist, add fixtures here (or under the feature module that only calls the gateway).

## Scope

| In scope                                      | Out of scope                         |
| --------------------------------------------- | ------------------------------------ |
| Fake-only offline runner (vitest / unit)      | Real OpenAI/Anthropic evals          |
| Typed fixtures + suite runner                 | Live HTTP eval admin UI              |
| Categories: happy, failure, redaction, gate, kill_switch, cap | Hallucination LLM-as-judge scoring |
| Evidence for feature-gate checklist item 7    | Bias review product workflow         |

## Fixture contract

Each fixture:

| Field        | Notes                                                                 |
| ------------ | --------------------------------------------------------------------- |
| `id`         | Stable string, e.g. `lab.echo.happy.en`                               |
| `category`   | `happy` \| `failure` \| `redaction` \| `gate` \| `kill_switch` \| `cap` |
| `description`| Human-readable intent                                                 |
| `env`        | Optional `AI_*` overrides for the case                                |
| `command`    | `featureCode`, `promptCode`, `locale`, `variables`                    |
| `prompt`     | Optional registry body/allowlist (defaults to seeded `lab.echo`)      |
| `meterUsed`  | Optional prior daily request count for cap cases                      |
| `expect`     | `status`, optional `rejectReason`, `outputText` match, `countUsage`   |

Runner rules:

1. Always use **Fake** `AiProviderPort` (never real SDKs).
2. Call gateway `invoke` only — no bypass of gate/redact/cap.
3. Restore process env after each fixture.
4. Persist is mocked; assert `countUsage` when relevant.

## Lab baseline fixtures

Shipped under `apps/api/src/modules/ai-gateway/eval/fixtures/` for `lab.echo`:

- happy echo
- blocked feature gate
- platform kill switch
- daily cap reject
- unknown placeholder
- long-message redaction

## How to run

```bash
npx vitest run apps/api/src/modules/ai-gateway/eval
```

Or full suite via `npm test` (includes these files).

## Adding fixtures for a new feature

1. Keep `featureCode` off the runtime allowlist until fixtures pass.
2. Add a fixture module + include it in the suite registry.
3. Cover at least: **happy**, **one failure**, **redaction** (if variables carry sensitive-shaped strings).
4. Link fixture ids in the feature task record (gate checklist #7).

## Non-goals

- Scoring model quality of real providers
- Storing eval results in Postgres in this slice
- Auto-promoting features onto the allowlist
