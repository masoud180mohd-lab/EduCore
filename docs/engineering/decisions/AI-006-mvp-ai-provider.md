# AI-006 — MVP real AI provider selection (decision brief)

| Field       | Value                                                     |
| ----------- | --------------------------------------------------------- |
| Decision ID | `AI-006`                                                  |
| Status      | **Accepted (solo-operator)** — 2026-08-04 (`GO AI-006`)   |
| Date        | 2026-08-04                                                |
| Program     | EPIC-AI-01 optional follow-on · ADR-003                   |
| Authority   | Solo-operator provisional (SOLO-GOV-001)                  |
| Governing   | `10_AI_GUIDELINES.md` · ACF-AI-001 · `AI_FEATURE_GATE.md` |

## Objective

Choose **one** lab-capable real LLM HTTP adapter behind `AiProviderPort`, env-gated, so operators can optionally leave Fake. **Fake remains CI/default.** Product AI features stay gate-blocked (`lab.echo` only).

## Options

| ID    | Vendor / path               | Pros                                      | Cons                                     |
| ----- | --------------------------- | ----------------------------------------- | ---------------------------------------- |
| **A** | **OpenAI** Chat Completions | Broad docs; cheap mini models; HTTPS JSON | US SaaS DPA / data residency diligence   |
| **B** | Anthropic Messages          | Strong safety posture                     | Second SDK/shape; less universal tooling |
| **C** | Defer (Fake only)           | Zero vendor risk                          | Does not satisfy AI-006 ask              |

### Decision

**Option A — OpenAI** as first real adapter (`provider_code=openai`).

| Field           | Value                                                                                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Opaque code     | `openai`                                                                                                                                                               |
| Fake in CI      | **Retained** — `AI_PROVIDER=fake` (default)                                                                                                                            |
| Env allowlist   | `AI_PROVIDER=fake\|disabled\|openai`; `OPENAI_API_KEY`; optional `OPENAI_BASE_URL` (default `https://api.openai.com`); optional `OPENAI_MODEL` (default `gpt-4o-mini`) |
| Missing keys    | **501 / `provider_not_configured`** — **never** silent Fake fallthrough when `AI_PROVIDER=openai`                                                                      |
| Transport       | HTTPS `fetch` Chat Completions — **no** OpenAI SDK dependency in v1                                                                                                    |
| Fallback vendor | Anthropic later (separate slice); not dual-live in this slice                                                                                                          |

## Non-goals

- Allowlisting product featureCodes
- RAG / embeddings
- Streaming SSE
- Committing secrets
- Changing Fake CI default

## Consequences

- Nest `OpenAiAiProvider` + config report script
- Kit Known Limitations: provider **chosen for lab adapter**; production DPA / residency still open
- ACF addendum `ACF-AI-006`
