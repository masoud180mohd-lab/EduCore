# AI Feature Gate (AI-001)

| Field     | Value                                    |
| --------- | ---------------------------------------- |
| Doc ID    | `AI_FEATURE_GATE`                        |
| Version   | `1.0`                                    |
| Date      | 2026-08-03                               |
| Epic      | EPIC-AI-01                               |
| Slice     | **AI-001**                               |
| Sources   | `EduCore/10_AI_GUIDELINES.md`, ADR-003   |
| Freezes   | DBF-AI-001 · ACF-AI-001                  |
| Authority | Solo-operator provisional (SOLO-GOV-001) |

**Purpose:** Define which `featureCode` values may invoke the AI Gateway, which stay blocked, and the release checklist before any product AI ships. The skeleton **enforces an allowlist even if the product list is empty** — only explicitly listed codes may invoke.

## Enforcement rules

1. Every `AiGatewayPort.invoke` **must** include `featureCode`, `tenantId`, `actorUserId`.
2. Gateway rejects any `featureCode` not in **Allowlist (runtime)** below (or config override that only **narrows** further).
3. Platform kill switch `AI_PLATFORM_ENABLED=false` disables **all** codes.
4. Per-feature disable flags (env/config) may turn off an otherwise allowlisted code.
5. High-risk / blocked codes must never appear on the runtime allowlist without a documented gate review + eval evidence.
6. No school-facing UI in EPIC-AI-01 — lab codes only for invoke until a later epic amends this gate.

## Feature code catalog

### Runtime allowlist (skeleton / EPIC-AI-01)

| featureCode | Purpose                     | Prompt(s)  | Human review | Status      |
| ----------- | --------------------------- | ---------- | ------------ | ----------- |
| `lab.echo`  | CI/local Fake gateway smoke | `lab.echo` | N/A (lab)    | **Allowed** |

Only `lab.echo` is allowed to invoke in AI-002…AI-005 unless this document is amended.

### Approved early (guidelines) — **blocked until later epic + gate amend**

These may become allowlisted only after privacy, budget, eval, and human-review criteria pass:

| featureCode (provisional)    | Maps to guidelines              | Notes                                |
| ---------------------------- | ------------------------------- | ------------------------------------ |
| `report.comment_draft`       | Report comment drafts           | Human review required before publish |
| `comms.parent_message_draft` | Parent message drafts           | No auto-send; human confirm          |
| `admin.summary`              | Admin summaries                 | Tenant-scoped; redact PII            |
| `dashboard.explain`          | Dashboard explanation           | Low-stakes narrative                 |
| `help.nl`                    | Natural language help           | No child PII in default prompts      |
| `i18n.translate_assist`      | Translation support with review | Human accept before official use     |

### High-risk — **blocked** (do not allowlist without dedicated review epic)

| featureCode (provisional)          | Why blocked                           |
| ---------------------------------- | ------------------------------------- |
| `predict.student_poor_performance` | Child labeling / academic stakes      |
| `predict.fee_default`              | Finance high-stakes                   |
| `recommend.intervention`           | Academic intervention without review  |
| `analytics.teacher_performance`    | Teacher ranking / narrative risk      |
| `tutor.memory`                     | Persistent child memory — default off |
| `voice.finance_or_child`           | Voice + sensitive data                |
| `label.child_failing`              | Explicitly forbidden auto-label       |
| `rank.teachers_poor`               | Explicitly forbidden auto-rank        |

Any code not listed in **Runtime allowlist** is treated as **blocked** (fail closed).

## Release gate checklist (before adding a product featureCode)

Copy this checklist into the feature’s task record; all items must be **Yes** or **N/A with reason**:

| #   | Check                                                                          | Evidence                  |
| --- | ------------------------------------------------------------------------------ | ------------------------- |
| 1   | Calls only `AiGatewayPort` (no provider SDK in domain module)                  | Code review / import lint |
| 2   | `featureCode` added to this doc + runtime allowlist amend                      | PR + gate version bump    |
| 3   | Prompt in registry with allowlisted placeholders only                          | Migration / seed          |
| 4   | Privacy: `redactForAi` path exercised; no unredacted child PII in default logs | Tests / fixtures          |
| 5   | Tenant + actor required; AuthZ on product permission                           | ACF / tests               |
| 6   | Budget: daily cap / metering defined; fail closed                              | Config + tests            |
| 7   | Eval fixtures exist (AI_EVAL_HARNESS) for happy + failure + redaction          | AI-005 pattern            |
| 8   | Human-review flag documented if guidelines require review                      | Product UX / API          |
| 9   | Kill switch / per-feature flag can disable without deploy                      | Config                    |
| 10  | No auto-send of AI text to parents/students                                    | Product rule              |
| 11  | Known Limitations / ADR conflicts checked                                      | Docs                      |

## Relationship to pipeline

Feature gate runs **before** prompt resolve and provider call (see ACF-AI-001). Budget and privacy stubs still run for allowlisted lab invokes.

## Non-goals

- Defining UX for report drafts or tutoring
- Choosing production LLM vendor
- Soft-allowing blocked codes “for demos”

## Amend process

1. Update this document (version bump).
2. Amend ACF/DBF if new HTTP or tables needed.
3. Add eval fixtures.
4. Implementation slice with tests proving allowlist + reject of blocked codes.
