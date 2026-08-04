# AI-006 — OpenAI real provider adapter (env-gated)

| Field     | Value |
| --------- | ----- |
| Program   | **AI-006** / EPIC-AI-01 optional follow-on |
| Date      | 2026-08-04 |
| Status    | **Done** (solo-operator provisional) |
| Depends   | AI-001…005 · ADR-003 · ACF-AI-001 |
| Decision  | `docs/engineering/decisions/AI-006-mvp-ai-provider.md` (**Accepted**) |
| Freeze    | `docs/engineering/api-contract-freeze/ACF-AI-006-openai-provider.md` |
| Authority | Solo-operator provisional (SOLO-GOV-001) |

## Delivered

- Decision: OpenAI as first real adapter (`provider_code=openai`); Fake remains CI default
- `OpenAiAiProvider` via `fetch` Chat Completions (no OpenAI SDK)
- `AI_PROVIDER=openai` without `OPENAI_API_KEY` → `provider_not_configured` / lab **501** — **never silent Fake**
- `npm run ai:check-config` operator report (secrets redacted)
- Env allowlist in `.env.example`

## Explicitly not done

- Anthropic adapter
- Streaming / embeddings / product feature allowlist expansion
- Production DPA / data-residency acceptance
- Committing secrets

## Operator

```bash
# default CI
AI_PROVIDER=fake

# optional lab
AI_PROVIDER=openai
OPENAI_API_KEY=...
npm run ai:check-config
```
