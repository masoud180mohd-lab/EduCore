# 22 Observability Bible

## Observability Goal

EduCore must know whether schools can complete real workflows, not only whether servers are running.

## Required Signals

- Logs.
- Metrics.
- Traces.
- Audit events.
- Business workflow events.
- Synthetic checks.

## Correlation

Every request, job, webhook, sync batch, and notification must carry a correlation ID.

## Business SLOs

Track:

- login success rate.
- attendance sync delay.
- payment confirmation delay.
- receipt generation success.
- notification delivery delay.
- report generation success.
- AI latency and cost.
- webhook backlog.
- failed sync operations.

## Technical SLOs

Track:

- API p95 latency.
- error rate.
- database connection usage.
- queue depth.
- worker failure rate.
- Redis memory.
- Postgres replication lag if replicas exist.

## Alerting Rules

Alert on:

- payment reconciliation backlog.
- cross-tenant security anomaly.
- sync failure spike.
- notification provider failure.
- backup failure.
- high AI spend.
- login failure spike.

## Dashboards

Minimum dashboards:

- executive health.
- API health.
- payments.
- notifications.
- offline sync.
- database.
- AI usage.
- tenant health.

