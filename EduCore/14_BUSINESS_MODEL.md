# 14 Business Model

## Business Model Summary

EduCore is a SaaS platform with subscription, per-student, and metered usage revenue.

## Revenue Streams

- Monthly and annual subscription plans.
- Per-student pricing.
- SMS and WhatsApp usage margin.
- Payment processing revenue where allowed.
- AI premium features.
- Enterprise white-label contracts.
- Future verification and API products.

## Cost Drivers

- Cloud infrastructure.
- PostgreSQL storage and backups.
- SMS delivery.
- WhatsApp conversations and templates.
- Payment gateway fees.
- AI tokens and embeddings.
- Support operations.
- Customer onboarding.

## Margin Rules

Every metered feature must emit usage events:

- SMS sent.
- WhatsApp message sent.
- AI request.
- storage used.
- payment transaction.
- report generation.

## Pricing Guardrails

- Do not give unlimited AI without budget controls.
- Do not give unlimited SMS/WhatsApp inside flat plans.
- Do not make enterprise isolation a cheap self-serve toggle.
- Do not let free trial tenants create high variable cost.

## Business KPIs

- Monthly recurring revenue.
- Gross margin by tenant.
- Active schools.
- Active students.
- Parent engagement.
- Payment volume.
- Notification delivery rate.
- Support tickets per school.
- Churn risk.

## Product-Led Growth Loop

Better parent communication increases parent trust. Better payment clarity increases school cashflow. Better academic visibility increases teacher and leadership adoption.

