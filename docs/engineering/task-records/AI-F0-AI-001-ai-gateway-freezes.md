# AI-F0 / AI-001 — AI Gateway freezes + feature gate

| Field     | Value |
| --------- | ----- |
| Program   | **AI-F0** + **AI-001** / EPIC-AI-01 |
| Date      | 2026-08-03 |
| Status    | **Done** (solo-operator provisional) — AI-002 implemented |
| Depends   | ADR-003 · `10_AI_GUIDELINES.md` · roadmap EPIC-AI-01 |
| Artifacts | `EPIC-AI-01-plan.md` · `DBF-AI-001-ai-gateway-skeleton.md` · `ACF-AI-001-ai-gateway-skeleton.md` · `docs/engineering/ai/AI_FEATURE_GATE.md` · `AI-002-ai-gateway-skeleton.md` |
| Authority | Solo-operator provisional (SOLO-GOV-001) |

## Delivered

- **Plan:** F-AI-01/02/03 → AI-001…AI-005; Fake default; Nest `ai-gateway/` (no FastAPI split)
- **DBF-AI-001:** `ai_prompt_templates`, `ai_invoke_requests`, `ai_usage_daily`; model routes env-only
- **ACF-AI-001:** `AiGatewayPort.invoke`; optional lab HTTP; `ai.read` / `ai.manage`
- **AI-001:** Feature gate — runtime allowlist `lab.echo` only; early guidelines features catalogued but blocked; high-risk blocked; release checklist

## Explicitly not done (at F0)

- (Superseded by AI-002) Nest module / migration / Fake — see `AI-002-ai-gateway-skeleton.md`

## Next

**AI-003** … **AI-005**, or stop after skeleton.
