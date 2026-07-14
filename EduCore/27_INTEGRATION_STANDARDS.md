# 27 Integration Standards

## Integration Principle

External systems are unreliable and inconsistent. Protect EduCore with adapters, contracts, retries, idempotency, and observability.

## Integration Types

- Payment gateways.
- SMS providers.
- WhatsApp providers.
- Email providers.
- Government systems.
- AI providers.
- Storage providers.
- Future partner APIs.

## Adapter Rules

Every adapter must:

- map external payloads to internal models.
- validate signatures where available.
- handle retries.
- expose provider health.
- log correlation IDs.
- avoid leaking provider-specific fields into domain models.

## Idempotency

Required for:

- payment callbacks.
- notification requests.
- AI batch jobs.
- government exports.
- imports.

## Provider Failover

Notification and payment strategies should allow adding another provider without changing domain workflows.

## Contract Testing

Use fixtures for provider payloads. Test duplicate, delayed, malformed, and failure responses.

