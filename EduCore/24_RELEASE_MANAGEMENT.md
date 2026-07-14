# 24 Release Management

## Release Philosophy

Release small, reversible changes. Avoid large risky launches.

## Environments

- local.
- dev.
- staging.
- production.

Staging should test migrations, webhooks, notifications, and background jobs.

## Feature Flags

Required for:

- AI features.
- offline sync changes.
- payment provider changes.
- new authorization policies.
- major UI workflows.

## Release Checklist

- tests pass.
- migrations reviewed.
- rollback plan exists.
- feature flags configured.
- monitoring exists.
- support team informed.
- documentation updated.

## Database Release Rules

Use expand-contract migrations. Avoid destructive changes in the same release that introduces new code.

## Rollback

Rollback must consider:

- application code.
- migrations.
- background jobs.
- feature flags.
- provider configuration.

## Post-Release Watch

Watch:

- error rates.
- payment failures.
- sync failures.
- notification delivery.
- login issues.
- support tickets.

