# API Contract Freeze — AI Gateway Skeleton (ACF-AI-001)

| Field     | Value                                                    |
| --------- | -------------------------------------------------------- |
| Freeze ID | `ACF-AI-001`                                             |
| Version   | `1.0`                                                    |
| Date      | 2026-08-03                                               |
| Companion | DBF-AI-001                                               |
| Program   | **EPIC-AI-01** (AI-F0)                                   |
| Gate      | `docs/engineering/ai/AI_FEATURE_GATE.md`                 |
| ADR       | ADR-003                                                  |
| Mirror    | ACF-014 (notifications) — Fake default, usage, lab HTTP  |
| Authority | Solo-operator provisional (SOLO-GOV-001)                 |

**Honesty:** Provisional. Internal port is the **primary** contract. Admin/lab HTTP is optional for operators — **not** school-facing AI product UI.

## Scope (v1)

| In scope                                              | Out of scope                                      |
| ----------------------------------------------------- | ------------------------------------------------- |
| Internal `AiGatewayPort.invoke(command) → result`     | Report-comment / parent-draft product APIs        |
| Optional admin lab: list prompts, usage, lab invoke   | RAG / embeddings APIs                             |
| Permissions `ai.read` / `ai.manage`                   | Real provider webhook callbacks                   |
| Kill switch + feature allowlist enforcement           | Public unauthenticated AI endpoints               |

## Placement

- Nest modular monolith: `apps/api/src/modules/ai-gateway/`
- **Not** a separate FastAPI service in this epic (future extract only; document in task records)
- Existing `ai-insights/` scaffold must **not** import provider SDKs; product modules call `AiGatewayPort` only

## Auth stack (HTTP lab)

Authenticated → Tenant header → Session tenant bind → Permission → RLS.

## Permissions

| Code         | Use                                                              |
| ------------ | ---------------------------------------------------------------- |
| `ai.read`    | GET prompts, GET usage, GET invoke request (if exposed)          |
| `ai.manage`  | POST lab invoke (Fake path); future manage ops                   |

Product features later use **their own** permission codes (e.g. `report.manage`); they still invoke only via `AiGatewayPort` after their AuthZ.

## Internal port (required)

```ts
// Conceptual — exact Nest DI token finalized in AI-002
AiGatewayPort.invoke(command: AiInvokeCommand): Promise<AiInvokeResult>
```

### `AiInvokeCommand` (required fields)

| Field          | Type   | Notes                                      |
| -------------- | ------ | ------------------------------------------ |
| tenantId       | uuid   | required                                   |
| actorUserId    | uuid   | required                                   |
| featureCode    | string | gate catalog; required                     |
| promptCode     | string | registry code; required                    |
| locale         | string | `en` \| `sw`                               |
| variables      | object | keys ⊆ prompt allowlist                    |
| correlationId  | string | required (caller or gateway-generated OK)  |

### `AiInvokeResult`

| Field       | Type   | Notes                                              |
| ----------- | ------ | -------------------------------------------------- |
| requestId   | uuid   | persisted invoke id                                |
| status      | string | `succeeded` \| `failed` \| `rejected` \| `disabled`|
| outputText  | string \| null | null when rejected/disabled                  |
| modelCode   | string \| null | e.g. `fake-echo-v1`                          |
| usage       | object \| null | `{ inputTokens, outputTokens, estimatedCostMinor }` |
| rejectReason| string \| null | when rejected/disabled                       |

### AuthZ responsibility (document)

- **HTTP lab:** controller checks `ai.manage` / `ai.read` before calling port.
- **Domain callers:** must already be authorized for their product action; gateway may include an optional AuthZ hook stub but **does not** replace product permission checks.
- Gateway **always** enforces: platform kill switch, feature allowlist, prompt resolve, variable allowlist, privacy stub, budget stub.

### Pipeline (skeleton order — AI-002)

1. Kill switch / `AI_PROVIDER=disabled`
2. Feature gate allowlist (and per-feature flag)
3. Resolve active prompt version
4. Render; reject unknown variables (400 / rejected)
5. `redactForAi(context)` — **must** be called
6. Daily cap stub (fail closed unless bypass)
7. `AiProviderPort` (Fake default)
8. Persist invoke + usage increment
9. Return result

Never expose provider API keys in results or HTTP bodies.

## Optional admin / lab HTTP

| Method | Path                              | AuthZ       | Notes                                              |
| ------ | --------------------------------- | ----------- | -------------------------------------------------- |
| GET    | `/api/v1/ai/prompts`              | `ai.read`   | Active system (+ later tenant) prompts             |
| GET    | `/api/v1/ai/usage`                | `ai.read`   | Daily meter; optional `date`, optional `featureCode`|
| POST   | `/api/v1/ai/lab/invoke`           | `ai.manage` | **Lab-only**; Fake provider; allowlisted features only |
| GET    | `/api/v1/ai/invokes/{requestId}`  | `ai.read`   | Optional; sanitized fields only                    |

### POST `/api/v1/ai/lab/invoke`

Body allowlist:

| Field         | Type         | Notes                         |
| ------------- | ------------ | ----------------------------- |
| featureCode   | string       | must be lab-allowed (e.g. `lab.echo`) |
| promptCode    | string       |                               |
| locale        | `en` \| `sw` | default `en`                  |
| variables     | object       | ⊆ prompt allowlist            |
| correlationId | string       | optional; server may generate |

Behavior:

1. Reject if platform disabled → `status=disabled` or HTTP **503** (prefer **200** with `data.status=disabled` for lab settle, **or** 503 — pick one in AI-002 and stick; recommend **200 + status** for kill switch mirroring skipped SMS).
2. Reject unknown feature / blocked gate → 400 or rejected status.
3. Fake path only in skeleton; real provider → **501** if somehow selected without keys (never silent Fake fallthrough when caller asked for real).
4. Persist + meter on success.

### GET `/api/v1/ai/usage`

Query: optional `date` (`YYYY-MM-DD`, UTC, default today); optional `featureCode`.

Response `data`: rows or aggregate with `usageDate`, `featureCode`, `requestCount`, `inputTokens`, `outputTokens`, `estimatedCostMinor`, `dailyCap`, `bypassDailyCap`, `platformEnabled`.

### GET `/api/v1/ai/prompts`

Returns: `code`, `version`, `locale`, `body`, `status`, `allowlistPlaceholders`.

## Resource allowlists

**AiPromptTemplate:** id, code, version, locale, body, status, allowlistPlaceholders, createdAt

**AiInvokeRequest (API):** id, tenantId, featureCode, promptCode, promptVersion, locale, correlationId, status, rejectReason, modelCode, providerCode, inputTokens, outputTokens, estimatedCostMinor, outputPreview (sanitized), createdAt — **never** raw unredacted PII fields

**AiUsageDaily:** usageDate, featureCode, requestCount, inputTokens, outputTokens, estimatedCostMinor

## Errors

| HTTP | When                                                              |
| ---- | ----------------------------------------------------------------- |
| 400  | validation / unknown placeholder / unknown or blocked featureCode |
| 401  | unauthenticated                                                   |
| 403  | missing `ai.*`                                                    |
| 404  | unknown invoke id (no cross-tenant leak)                          |
| 409  | daily cap exceeded (if using explicit conflict; else rejected)    |
| 501  | real provider path without keys / not implemented                 |
| 503  | optional: platform kill switch (if not using 200+disabled)        |

## Config (runtime)

| Env                         | Role                                      |
| --------------------------- | ----------------------------------------- |
| `AI_PLATFORM_ENABLED`       | Kill switch (default true in lab; false disables) |
| `AI_PROVIDER`               | `fake` \| `disabled`                      |
| `AI_DAILY_CAP_PER_TENANT`   | Cap                                       |
| `AI_BYPASS_DAILY_CAP`       | Lab bypass                                |

## Non-goals

- School portal AI chat APIs
- Streaming SSE/WebSocket AI (deferred)
- OpenAI/Anthropic SDK exposure outside `ai-gateway` providers folder

## Solo-operator honesty

Provisional for EPIC-AI-01. OpenAPI companion may land with AI-002/003. Provider selection remains open.
