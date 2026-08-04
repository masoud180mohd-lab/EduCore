# Database Freeze — AI Gateway (DBF-AI-001)

| Field     | Value                                    |
| --------- | ---------------------------------------- |
| Freeze ID | `DBF-AI-001`                             |
| Version   | `1.0`                                    |
| Date      | 2026-08-03                               |
| Companion | ACF-AI-001                               |
| Program   | **EPIC-AI-01** (AI-F0)                   |
| Governing | ADR-003 · 10_AI_GUIDELINES               |
| Authority | Solo-operator provisional (SOLO-GOV-001) |

**Honesty:** Provisional skeleton schema. Provider/model not production-chosen (`46_KNOWN_LIMITATIONS`). No RAG/vector tables. No product AI feature tables beyond invoke + meter + prompts.

## Scope (v1)

| In scope                                         | Out of scope                         |
| ------------------------------------------------ | ------------------------------------ |
| Prompt templates (versioned, allowlisted tokens) | Free-form school prompt editor UI    |
| Invoke request ledger                            | Embedding / vector / RAG stores      |
| Daily usage meter by tenant + featureCode        | Training datasets / model fine-tunes |
| Optional env-only model routing (no table req.)  | Conversation / tutor memory tables   |

## RLS

- Pattern A: tenant tables carry `tenant_id`; policies require active membership.
- `educore_app`: SELECT; writes via **SECURITY DEFINER** helpers (same posture as finance/notifications).
- System prompts: `tenant_id IS NULL` (shared catalog); tenant overrides later (optional, out of skeleton MVP).

## Tables (v1)

### `ai_prompt_templates`

| Column     | Type        | Notes                                                  |
| ---------- | ----------- | ------------------------------------------------------ |
| id         | uuid PK     |                                                        |
| tenant_id  | uuid NULL   | NULL = **system** template                             |
| code       | text        | e.g. `lab.echo`                                        |
| locale     | text        | `en` \| `sw` (v1)                                      |
| version    | int         | ≥ 1; immutable once inserted — edits → **new version** |
| body       | text        | placeholders `{{token}}` only                          |
| status     | text        | `active` \| `retired`                                  |
| created_at | timestamptz |                                                        |

UNIQUE treating NULL tenant as system: `(tenant_id, code, locale, version)`.

CHECK: `locale IN ('en','sw')`; body length ≤ 8000 (skeleton).

**Allowlist:** placeholder names enforced in application (mirror SMS templates); optional `placeholders_json text[]` column deferred — app catalog is source of truth for AI-002/003.

### `ai_invoke_requests`

| Column               | Type        | Notes                                                               |
| -------------------- | ----------- | ------------------------------------------------------------------- |
| id                   | uuid PK     |                                                                     |
| tenant_id            | uuid FK     | RLS                                                                 |
| actor_user_id        | uuid        | who invoked                                                         |
| feature_code         | text        | must be in AI-001 allowlist                                         |
| prompt_code          | text        |                                                                     |
| prompt_version       | int         | resolved at invoke                                                  |
| locale               | text        |                                                                     |
| status               | text        | `accepted` \| `succeeded` \| `failed` \| `skipped` \| `disabled`    |
| skip_reason          | text NULL   | e.g. `kill_switch`, `feature_blocked`, `daily_cap`, `provider_off`  |
| correlation_id       | text NULL   | request/correlation trace                                           |
| model_code           | text NULL   | e.g. `fake-echo-v1`                                                 |
| provider_code        | text NULL   | `fake` \| `disabled` (real later)                                   |
| input_tokens         | int NULL    | estimate; Fake may use 0 or char heuristic                          |
| output_tokens        | int NULL    |                                                                     |
| estimated_cost_minor | int NULL    | minor currency units; Fake often 0                                  |
| output_text          | text NULL   | **lab only** — retention policy TBD; production may store hash only |
| variables_json       | jsonb       | allowlisted rendered inputs **after** redaction stub                |
| idempotency_key      | text NULL   | optional for lab; required if HTTP create exposes retries           |
| created_at           | timestamptz |                                                                     |
| updated_at           | timestamptz |                                                                     |

UNIQUE optional `(tenant_id, idempotency_key)` when key present.

**PII:** default logging must not dump `variables_json` + child identifiers at info level; prefer structured fields without raw student names when redaction applied.

### `ai_usage_daily`

| Column               | Type        | Notes                                   |
| -------------------- | ----------- | --------------------------------------- |
| tenant_id            | uuid        | PK part                                 |
| usage_date           | date        | UTC date; PK part                       |
| feature_code         | text        | PK part                                 |
| request_count        | int         | successful + failed attempts that count |
| input_tokens         | int         |                                         |
| output_tokens        | int         |                                         |
| estimated_cost_minor | int         |                                         |
| updated_at           | timestamptz |                                         |

PK `(tenant_id, usage_date, feature_code)`.

### `ai_model_routes` (optional)

**Skeleton decision:** **env/config-only** routing (`AI_PROVIDER`, model code constants). Table deferred until multi-model production routing is needed. If added later: `(feature_code, provider_code, model_code, priority, status)`.

## Indexes

- `ai_invoke_requests (tenant_id, created_at DESC)`
- `ai_invoke_requests (tenant_id, feature_code, created_at DESC)`
- `ai_prompt_templates (code, locale, status)` where active

## Non-goals

- Vector / embedding tables
- Persistent chat sessions
- Storing provider API keys in DB

## Solo-operator honesty

Provisional until countersigned. Migrations land only after **GO AI-002**.
