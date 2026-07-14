# 10 AI Guidelines

## AI Position

AI is a product advantage, but trust is more important than novelty. AI must assist users and improve insight without exposing private data or making unreviewed high-stakes decisions.

## AI Architecture

All AI calls go through AI Gateway.

AI Gateway owns:

- model registry.
- prompt registry.
- provider routing.
- tenant budgets.
- PII redaction.
- safety filters.
- logging with privacy controls.
- evaluations.
- feature flags.
- rate limits.

No frontend, backend module, or worker may call an LLM provider directly.

## Approved Early AI Features

Allowed first:

- Report comment drafts.
- Parent message drafts.
- Admin summaries.
- Dashboard explanation.
- Natural language help.
- Translation support with review.

Require review before release:

- Student poor performance prediction.
- Fee default prediction.
- Intervention recommendation.
- Teacher performance analytics.
- AI tutor memory.
- Voice assistant for financial or child data.

## High-Risk AI Rules

AI must not:

- Automatically label a child as failing without review.
- Automatically rank teachers as poor performers.
- Send sensitive parent messages without human confirmation.
- Reveal data outside tenant or relationship scope.
- Use student data to train external models unless legally and contractually approved.

## Data Privacy

Before sending data to AI:

- Check tenant policy.
- Check user permission.
- Redact PII where possible.
- Minimize context.
- Avoid health and discipline data unless explicitly needed and allowed.
- Log purpose and feature.

## Cost Control

Track:

- tokens by tenant.
- requests by feature.
- cost by model.
- failure rate.
- latency.

Use:

- cheaper models for simple tasks.
- caching for deterministic summaries.
- batch processing for scheduled reports.
- tenant-level AI budgets.

## Evaluation

Every AI feature needs:

- test dataset.
- expected behavior.
- failure examples.
- hallucination checks.
- privacy checks.
- bias review where relevant.
- human acceptance criteria.

## RAG And AI Memory

Vector search must obey authorization.

Rules:

- tenant namespace.
- source document permissions.
- embedding model version.
- deletion propagation.
- retrieval logs.
- no persistent child memory by default.

## Human Review

Required for:

- official report comments in early phases.
- disciplinary suggestions.
- high-risk academic intervention recommendations.
- finance-related AI messages.
- teacher performance narratives.

