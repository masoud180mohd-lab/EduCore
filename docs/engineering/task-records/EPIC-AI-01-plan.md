# EPIC-AI-01 Plan — AI Gateway Foundation (skeleton first)

| Field        | Value                                                                               |
| ------------ | ----------------------------------------------------------------------------------- |
| Epic         | EPIC-AI-01                                                                          |
| Roadmap      | WS-17 · F-AI-01 / F-AI-02 / F-AI-03 (`EduCore/39_ENGINEERING_EXECUTION_ROADMAP.md`) |
| ADR          | ADR-003 (AI Gateway required)                                                       |
| Guidelines   | `EduCore/10_AI_GUIDELINES.md`                                                       |
| Constitution | `EduCore/03_DEVELOPMENT_CONSTITUTION.md` — no direct LLM calls                      |
| Mode         | Solo-operator (SOLO-GOV-001)                                                        |
| Freeze gate  | AI-F0 — this plan + DBF-AI-001 + ACF-AI-001 + AI-001 gate                           |
| Status       | **AI-006 Done** — OpenAI adapter env-gated; Fake still CI default                   |

## Mission

Ship a **safe AI Gateway skeleton** so future AI features cannot call providers directly. **Foundation only** — no school-facing AI product UI, no RAG, no tutoring, no real provider adapter in this epic’s default path.

## Feature → task map

| Roadmap feature             | Slice ID     | Deliverable                                                                                      | Depends on                       |
| --------------------------- | ------------ | ------------------------------------------------------------------------------------------------ | -------------------------------- |
| F-AI-01 AI Gateway skeleton | **AI-001**   | Feature gate catalog + release checklist (`AI_FEATURE_GATE.md`)                                  | AI-F0                            |
| F-AI-01                     | **AI-002** ★ | Nest `ai-gateway/` module: `AiGatewayPort`, Fake provider, pipeline, kill switch, metering write | AI-001 + freezes + **GO AI-002** |
| F-AI-02 Prompt registry     | **AI-003**   | Seed lab prompt(s), version immutability, admin list                                             | AI-002                           |
| F-AI-01 metering            | **AI-004**   | Daily usage rows + GET usage + cap/bypass                                                        | AI-002                           |
| F-AI-03 Evaluation harness  | **AI-005**   | Spec + fixture runner (Fake only)                                                                | AI-002                           |

Optional later (out of epic default): **AI-006** real provider adapter behind separate freeze + env keys.

## Freezes (AI-F0)

| Artifact     | Path                                                                     |
| ------------ | ------------------------------------------------------------------------ |
| DB freeze    | `docs/engineering/database-freeze/DBF-AI-001-ai-gateway-skeleton.md`     |
| API freeze   | `docs/engineering/api-contract-freeze/ACF-AI-001-ai-gateway-skeleton.md` |
| Feature gate | `docs/engineering/ai/AI_FEATURE_GATE.md`                                 |

## Architecture decision (provisional)

| Topic              | Decision                                                                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Placement          | Nest modular monolith module `apps/api/src/modules/ai-gateway/` (not a separate FastAPI service)                                                   |
| Future extract     | FastAPI AI Gateway microservice remains a **future** option per architecture kit; document only — no split in this epic                            |
| Placeholder module | Existing `ai-insights/` scaffold stays product-facing placeholder; **do not** put provider calls there — domain features call `AiGatewayPort` only |
| Provider default   | `AI_PROVIDER=fake` (CI/local), mirror Fake SMS                                                                                                     |
| Real keys          | Optional later; missing keys → clear **501 / disabled**, never silent bypass                                                                       |
| Model routes       | **Env/config-only** for skeleton (no `ai_model_routes` table in DBF-AI-001 v1)                                                                     |

## Pipeline order (AI-002 target)

1. Authz hook / require caller already authorized (document in ACF)
2. Feature gate allowlist (`featureCode`)
3. Resolve prompt version from registry
4. Render template; reject unknown variables
5. Privacy filter stub `redactForAi(context)` (must be called)
6. Budget/rate-limit stub (fail closed over daily cap)
7. Route to `AiProviderPort` (Fake default)
8. Persist invoke request + usage increment
9. Return `{ requestId, status, outputText, modelCode, usage }`

## Non-goals (epic)

- School-facing AI UI (report drafts, parent drafts, tutor)
- Real OpenAI/Anthropic adapter (AI-006 later)
- RAG / embeddings / vector DB
- Training on tenant data
- Auto-send messages to parents/students
- FastAPI microservice split
- High-risk predictions (fee default, teacher ranking, child labeling)

## Protocol

1. **AI-F0** — freezes + plan + AI-001 gate → **STOP**
2. User replies **`GO AI-002`** → implement skeleton → verify → handoff
3. Then AI-003 → AI-004 → AI-005 in order (or as follow-up GOs)
4. Update `EduCore/46_KNOWN_LIMITATIONS.md` after skeleton lands: gateway exists; provider still not production-chosen

## Acceptance (epic / F-AI-01) — after implementation

1. ADR-003 enforceable: single gateway entry for AI invokes
2. Fake path green in CI with metering rows
3. Kill switch disables invokes
4. Prompt registry + lab prompt seeded
5. Freezes + plan + AI-001…005 task records exist
6. Known Limitations updated honestly
