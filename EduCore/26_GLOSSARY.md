# 26 Glossary

## Key Terms

Tenant: a school or school group using EduCore.

RLS: PostgreSQL Row-Level Security used as database-level tenant protection.

MVP: minimum viable product, limited to trust-building core workflows.

Ledger: immutable accounting record used as the source of truth for balances.

Journal Entry: accounting transaction with balanced debit and credit lines.

Payment Attempt: attempt to collect money through a provider.

Webhook: external provider callback.

Reconciliation: process of comparing internal payment state with provider/bank state.

Offline Operation: mutation created on a device while offline or unstable.

AI Gateway: central service that controls model calls, prompts, privacy, budgets, and evaluation.

Policy Decision: authorization result based on role, relationship, tenant, and context.

Outbox: database-backed event queue written in the same transaction as domain changes.

BFF: backend-for-frontend endpoint shaped for a specific role or workflow.

SLO: service level objective.

RPO: recovery point objective.

RTO: recovery time objective.

