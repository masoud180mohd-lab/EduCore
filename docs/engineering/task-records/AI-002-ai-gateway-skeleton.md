# AI-002 — AI Gateway skeleton (Fake + pipeline)

| Field     | Value |
| --------- | ----- |
| Program   | **AI-002** / EPIC-AI-01 / F-AI-01 |
| Date      | 2026-08-03 |
| Status    | **Done** (solo-operator provisional) |
| Depends   | AI-F0 · AI-001 · DBF-AI-001 · ACF-AI-001 · `GO AI-002` (user B / EPIC-AI) |
| Authority | Solo-operator provisional (SOLO-GOV-001) |

## Delivered

- Migration `20260803160000_ai_gateway_create` — tables, RLS, `app.ai_complete_invoke`, permissions `ai.read` / `ai.manage`, seed `lab.echo` (en/sw)
- Nest module `apps/api/src/modules/ai-gateway/` — `AiGatewayPort` / Fake provider / kill switch / feature gate / redact stub / daily cap / lab HTTP
- Lab routes: `GET /api/v1/ai/prompts`, `GET /api/v1/ai/usage`, `POST /api/v1/ai/lab/invoke`, `GET /api/v1/ai/invokes/:requestId`
- Env: `AI_PLATFORM_ENABLED`, `AI_PROVIDER=fake|disabled`, `AI_DAILY_CAP_PER_TENANT`, `AI_BYPASS_DAILY_CAP`, `AI_FEATURE_DISABLED`
- Kill switch returns **200 + `status=disabled`** (lab settle); daily cap → **409**
- Registered in `AppModule` / bounded-context registry (15 modules)
- Unit tests for gate + Fake pipeline + bootstrap count

## Explicitly not done

- Real OpenAI/Anthropic adapter (AI-006)
- School-facing AI product UI
- Eval harness (AI-005) / prompt-admin polish beyond seed (AI-003 follow-up)
- FastAPI microservice extract

## Next

**AI-003** prompt registry polish → **AI-004** usage hardening → **AI-005** eval harness (or `GO AI-003`).
