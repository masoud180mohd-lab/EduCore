# 20 Payment And Accounting Bible

## Prime Rule

The ledger is the source of truth. Balances are derived, not manually trusted.

## Core Concepts

- Invoice: what is owed.
- Payment Attempt: request to collect money.
- Gateway Event: provider callback or status.
- Receipt: accepted payment confirmation.
- Journal Entry: immutable accounting event.
- Reconciliation: comparison between provider, bank, and internal records.
- Reversal: correction entry.

## Ledger Invariants

- Every posted journal entry balances.
- Posted entries are immutable.
- Corrections use reversals.
- Every receipt references accepted payment and ledger entry.
- Every payment allocation references invoice lines.

## Payment Provider Rules

- Never trust client amount.
- Validate webhook signature.
- Store raw provider event safely.
- Deduplicate callbacks.
- Handle delayed and out-of-order callbacks.
- Reconcile independently from webhook success.

## State Machines

Payment attempt states:

- created.
- initiated.
- pending.
- succeeded.
- failed.
- expired.
- reversed.
- disputed.

Invoice states:

- draft.
- issued.
- partially_paid.
- paid.
- void.
- written_off.

## Reconciliation

Reconciliation must identify:

- internal success but provider failure.
- provider success but internal pending.
- duplicate provider event.
- amount mismatch.
- settlement mismatch.
- missing receipt.

## Tests Required

- duplicate webhook.
- amount mismatch.
- partial payment.
- overpayment.
- failed provider.
- reversal.
- ledger balancing.

