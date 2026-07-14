# Sprint 1: Database Design Freeze

## Goal

Freeze database design before backend implementation.

## Required Inputs

- Architecture Freeze v1.0.
- SRS.
- Project Architecture.
- Database Design Bible.
- Payment and Accounting Bible.
- Offline Sync Bible.
- Access Control Bible.

## Work Items

- Define bounded-context table ownership.
- Create ERD.
- Define tenant-owned tables.
- Define RLS policies.
- Define finance ledger tables.
- Define payment event tables.
- Define offline operation tables.
- Define audit/outbox tables.
- Define indexes and partition candidates.
- Define migration strategy.
- Define seed strategy.
- Define database test strategy.

## Deliverables

- frozen ERD.
- schema specification.
- RLS policy specification.
- migration strategy.
- tenant isolation test matrix.

## Exit Criteria

- No unclear table ownership.
- No tenant-owned table without RLS plan.
- No finance balance model outside ledger rules.
- No offline table without sync strategy.
- Database Freeze v1.0 accepted.

