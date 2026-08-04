# Database Freeze — AI Gateway Skeleton (DBF-AI-001)

| Field     | Value                                                          |
| --------- | -------------------------------------------------------------- |
| Freeze ID | `DBF-AI-001`                                                   |
| Version   | `1.1`                                                          |
| Date      | 2026-08-03                                                     |
| Companion | ACF-AI-001                                                     |
| Program   | **EPIC-AI-01** (AI-F0; AI-004 metering policy clarified)       |
| Gate      | `docs/engineering/ai/AI_FEATURE_GATE.md`                       |
| ADR       | ADR-003                                                        |
| Mirror    | DBF-013 (notifications) — Fake default, daily meter, Pattern A |
| Authority | Solo-operator provisional (SOLO-GOV-001)                       |

**Honesty:** Provisional. Minimal persistence for AI Gateway skeleton only. No RAG tables, no embeddings, no product AI feature storage. Model routing is **env/config-only** in v1 (no `ai_model_routes` table).

## Scope (v1)

| In scope                                        | Out of scope                                        |
| ----------------------------------------------- | --------------------------------------------------- |
| Prompt templates (system lab seed)              | Free-form school prompt editor                      |
| Invoke request ledger (status + sanitized meta) | Storing raw unredacted child PII prompts by default |
| Daily usage meter (tenant × feature × date)     | Cost invoices / billing product                     |
| Version immutability of prompt bodies           | Vector / RAG / memory tables                        |
|                                                 | Real provider webhook / DLR tables                  |

## RLS

- Pattern A: tenant-scoped tables have `tenant_id`; policies require active membership.
- System prompt templates: `tenant_id` NULL = platform catalog (readable by lab helpers; not tenant-writable in v1).
- `educore_app`: SELECT on tables; writes via **SECURITY DEFINER** helpers only (same as finance / notifications).

## Tables (v1)

### `ai_prompt_templates`

| Column                 | Type        | Notes                                                                                       |
| ---------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| id                     | uuid PK     |                                                                                             |
| tenant_id              | uuid NULL   | NULL = **system** template; non-null = tenant override (**deferred** — v1 seed system only) |
| code                   | text        | e.g. `lab.echo`                                                                             |
| version                | int         | ≥ 1; immutable body once inserted                                                           |
| locale                 | text        | `en` \| `sw` (v1)                                                                           |
| body                   | text        | placeholders `{{token}}` only                                                               |
| status                 | text        | `active` \| `retired`                                                                       |
| allowlist_placeholders | jsonb       | array of allowed variable names, e.g. `["message"]`                                         |
| created_at             | timestamptz |                                                                                             |

UNIQUE treating NULL tenant as system: `(COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), code, locale, version)`.

CHECK: `locale IN ('en','sw')`; `status IN ('active','retired')`; `version >= 1`.

**Immutability:** edits create a **new** `version` row; prior versions set `retired` or left active=false via status. Never UPDATE `body` in place.

**Seed (AI-003):** at least one lab prompt, e.g. `lab.echo` / `en` / v1 body `ECHO: {{message}}` with allowlist `["message"]`.

### `ai_invoke_requests`

| Column               | Type        | Notes                                                                                         |
| -------------------- | ----------- | --------------------------------------------------------------------------------------------- |
| id                   | uuid PK     | = gateway `requestId`                                                                         |
| tenant_id            | uuid FK     | RLS                                                                                           |
| actor_user_id        | uuid        | required                                                                                      |
| feature_code         | text        | must be gate-catalog code (e.g. `lab.echo`)                                                   |
| prompt_code          | text        |                                                                                               |
| prompt_version       | int         | resolved at invoke                                                                            |
| locale               | text        |                                                                                               |
| correlation_id       | text        | client or generated; for audit correlation                                                    |
| status               | text        | `succeeded` \| `failed` \| `rejected` \| `disabled`                                           |
| reject_reason        | text NULL   | e.g. `feature_blocked`, `unknown_variable`, `daily_cap`, `platform_disabled`, `privacy`       |
| model_code           | text NULL   | e.g. `fake-echo-v1`                                                                           |
| provider_code        | text NULL   | `fake` \| `disabled` (real codes later)                                                       |
| input_tokens         | int NULL    | ≥ 0 when known                                                                                |
| output_tokens        | int NULL    | ≥ 0 when known                                                                                |
| estimated_cost_minor | int NULL    | minor currency units estimate; Fake may use 0                                                 |
| output_preview       | text NULL   | **optional truncated sanitized** preview for lab; never store unredacted child PII by default |
| variables_redacted   | jsonb NULL  | redacted variable map after privacy stub (preferred over raw)                                 |
| created_at           | timestamptz |                                                                                               |

Indexes: `(tenant_id, created_at DESC)`; `(tenant_id, feature_code, created_at DESC)`.

**Logging honesty:** Default config must **not** persist raw prompts that contain unredacted child PII. Lab `lab.echo` may store short sanitized preview only.

### `ai_usage_daily`

| Column               | Type                                  | Notes                         |
| -------------------- | ------------------------------------- | ----------------------------- |
| tenant_id            | uuid                                  |                               |
| usage_date           | date                                  | UTC date of invoke completion |
| feature_code         | text                                  |                               |
| request_count        | int                                   | ≥ 0                           |
| input_tokens         | int                                   | ≥ 0                           |
| output_tokens        | int                                   | ≥ 0                           |
| estimated_cost_minor | int                                   | ≥ 0                           |
| PRIMARY KEY          | (tenant_id, usage_date, feature_code) |                               |

Incremented in the same transaction as a successful Fake (or future real) invoke that counts toward budget. Rejected/disabled invokes **do not** increment token totals; optional separate reject metrics deferred.

## Model routes (v1 — config only)

No `ai_model_routes` table in this freeze.

| Config                    | Notes                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `AI_PROVIDER`             | `fake` \| `disabled` (skeleton); real later                                                                        |
| `AI_PLATFORM_ENABLED`     | kill switch; `false` → all invokes disabled                                                                        |
| `AI_DAILY_CAP_PER_TENANT` | Max **sum of request_count** across all featureCodes for tenant + UTC date (default 100). Token-sum caps deferred. |
| `AI_BYPASS_DAILY_CAP`     | lab bypass (mirror `SMS_BYPASS_DAILY_CAP`)                                                                         |
| Per-feature flags         | env or config map; e.g. disable `lab.echo`                                                                         |

## Helpers (names provisional; finalize in AI-002/003 migration)

| Helper (suggested)              | Purpose                              |
| ------------------------------- | ------------------------------------ |
| `ai_list_active_prompts(...)`   | Lab list active templates            |
| `ai_get_active_prompt(...)`     | Resolve code+locale → active version |
| `ai_insert_invoke_request(...)` | Persist invoke row                   |
| `ai_increment_usage_daily(...)` | Upsert daily meter                   |
| `ai_get_usage_daily(...)`       | Read meter for date                  |

Exact signatures land with migration; freeze locks **tables and semantics**.

## Non-goals

- Embedding / chunk / document tables
- Fine-tune job tables
- Storing provider API keys in DB
- Cross-tenant analytics warehouse

## Solo-operator honesty

Provisional for EPIC-AI-01 lab. Provider/model selection remains open (`EduCore/46_KNOWN_LIMITATIONS.md`).
