# AI-005 — Evaluation harness (Fake only)

| Field     | Value                                             |
| --------- | ------------------------------------------------- |
| Program   | **AI-005** / EPIC-AI-01 / F-AI-03                 |
| Date      | 2026-08-04                                        |
| Status    | **Done** (solo-operator provisional)              |
| Depends   | AI-002…AI-004 · `AI_FEATURE_GATE.md` checklist #7 |
| Spec      | `docs/engineering/ai/AI_EVAL_HARNESS.md`          |
| Authority | Solo-operator provisional (SOLO-GOV-001)          |

## Delivered

- Spec `AI_EVAL_HARNESS.md` — fixture contract, Fake-only rules, amend process
- Runner `apps/api/src/modules/ai-gateway/eval/` — `runAiEvalFixture` / `runAiEvalSuite`
- Baseline fixtures for `lab.echo`: happy, gate, kill switch, cap, unknown variable, redaction, meter_unavailable
- Vitest suite proves gate checklist categories happy + failure + redaction
- Public barrel exports for reuse when adding product featureCodes

## Explicitly not done

- Real-provider eval / LLM-as-judge
- Persisting eval runs in Postgres
- Admin HTTP for eval results
- AI-006 real provider adapter

## Next

EPIC-AI-01 foundation complete for default path. Optional later: **AI-006** real provider behind separate freeze + secrets.
