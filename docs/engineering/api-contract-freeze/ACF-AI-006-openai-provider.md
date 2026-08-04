# API Contract Freeze Addendum — OpenAI provider (ACF-AI-006)

| Field     | Value                                                    |
| --------- | -------------------------------------------------------- |
| Freeze ID | `ACF-AI-006`                                             |
| Version   | `1.0`                                                    |
| Date      | 2026-08-04                                               |
| Parent    | ACF-AI-001                                               |
| Decision  | `docs/engineering/decisions/AI-006-mvp-ai-provider.md`   |
| Authority | Solo-operator provisional (SOLO-GOV-001)                 |

## Config

| Env               | Role                                              |
| ----------------- | ------------------------------------------------- |
| `AI_PROVIDER`     | `fake` (default) \| `disabled` \| `openai`        |
| `OPENAI_API_KEY`  | Required when `AI_PROVIDER=openai`                |
| `OPENAI_BASE_URL` | Optional; default `https://api.openai.com`        |
| `OPENAI_MODEL`    | Optional; default `gpt-4o-mini`                   |

## Behaviour

1. `AI_PROVIDER=fake` → Fake adapter (CI).
2. `AI_PROVIDER=disabled` → gateway `status=disabled` (unchanged).
3. `AI_PROVIDER=openai` + key present → `OpenAiAiProvider` (`provider_code=openai`).
4. `AI_PROVIDER=openai` + key **missing** → invoke settles `status=failed`, `rejectReason=provider_not_configured`; lab HTTP **501 NOT_IMPLEMENTED**. **No silent Fake.**
5. Never log or return API keys.

## Port

Still `AiProviderPort.generate` only. OpenAI HTTP lives under `ai-gateway/providers/` only.

## Non-goals

- Anthropic adapter, streaming, embeddings, Azure-specific auth variants beyond base URL override.
