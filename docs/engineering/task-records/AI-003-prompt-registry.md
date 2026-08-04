# AI-003 — Prompt registry (seed + immutability + admin list)

| Field     | Value                                    |
| --------- | ---------------------------------------- |
| Program   | **AI-003** / EPIC-AI-01 / F-AI-02        |
| Date      | 2026-08-03                               |
| Status    | **Done** (solo-operator provisional)     |
| Depends   | AI-002 · DBF-AI-001 · ACF-AI-001         |
| Authority | Solo-operator provisional (SOLO-GOV-001) |

## Delivered

- Migration `20260803170000_ai_prompt_registry` — immutability trigger (body/code/version/locale/allowlist cannot UPDATE in place); `app.ai_publish_system_prompt_version` for migrator/platform; idempotent `lab.echo` seed ensure
- App catalog `AI_LAB_PROMPT_CATALOG` mirroring seed (`lab.echo` en/sw)
- `GET /api/v1/ai/prompts` polish: filters `code`, `locale`, `includeRetired`; response `meta.catalog`; active list uses one row per `(code, locale)` (tenant override preferred)
- No HTTP create/edit of prompts (publish via migration helper only)

## Explicitly not done

- Tenant-owned prompt editor UI
- Product prompt codes beyond `lab.echo`
- AI-004 usage hardening / AI-005 eval harness

## Next

**AI-004** usage meter polish, or stop.
