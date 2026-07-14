# 12 Deployment Guidelines

## Deployment Philosophy

Start simple, but not careless. Production must be reproducible, observable, and recoverable from day one.

## Environments

Required:

- local.
- development.
- staging.
- production.

Staging must resemble production enough to test migrations, payments, webhooks, and background jobs.

## Infrastructure

MVP can run on simple infrastructure if it has:

- reproducible IaC.
- managed or well-operated PostgreSQL.
- automated backups.
- private object storage.
- Redis.
- background workers.
- monitoring.
- alerting.

Kubernetes is not required for MVP. Add it when deployment scale and team maturity justify it.

## CI/CD

Pipeline must include:

- lint.
- type check.
- unit tests.
- integration tests.
- build.
- migration check.
- security scan.
- deploy to staging.
- manual approval for production.

## Database Migrations

Use expand-contract:

1. Add new nullable column/table.
2. Deploy app that writes both if needed.
3. Backfill.
4. Switch reads.
5. Remove old column only after verification.

Never deploy destructive migrations without backup and rollback plan.

## Secrets

Use a secrets manager.

Never commit:

- API keys.
- database passwords.
- JWT secrets.
- payment provider credentials.
- AI provider keys.
- webhook signing secrets.

## Observability

Every service must emit:

- logs.
- metrics.
- traces.
- health checks.

Track workflow SLOs:

- login success.
- attendance sync delay.
- payment confirmation delay.
- notification delivery delay.
- report generation success.
- AI cost and latency.
- webhook processing backlog.

## Backup And Disaster Recovery

Requirements:

- Point-in-time recovery.
- Daily backup verification.
- Restore drills.
- Object storage backup.
- Runbooks.
- Defined RPO and RTO.

Suggested targets:

- MVP RPO: 24 hours maximum, improve quickly.
- MVP RTO: 8 hours maximum, improve quickly.
- Pro+ target after maturity: RPO under 1 hour, RTO under 2 hours.

## Release Safety

Use:

- feature flags.
- canary or staged rollout where possible.
- manual approval for risky changes.
- rollback plan.
- incident communication plan.

## Incident Response

Every incident should produce:

- timeline.
- impact.
- root cause.
- customer communication where needed.
- remediation.
- prevention action.

