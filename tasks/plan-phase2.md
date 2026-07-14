# Implementation Plan: Audit Remediation Phase 2 (G3)

## Overview

Harden Identity/Tenant RLS against GUC spoofing on INSERT paths, introduce a dedicated platform provisioning role, and add live PostgreSQL isolation tests that run when a database is available (skip cleanly otherwise).

## Threat model (INSERT path)

- **Asset:** ability to create `tenants` / `users` rows.
- **Attacker:** any client using `educore_app` who can issue `SET LOCAL app.rls_mode = 'bootstrap'`.
- **Bug:** INSERT policies used `is_platform_operator() OR rls_mode IN (...)`.
- **Fix:** require both GUCs **and** revoke INSERT from `educore_app`; grant INSERT only to `educore_platform`.

## Tasks

- [ ] Forward migration `20260714170000_rls_insert_hardening`
- [ ] Update role bootstrap for `educore_platform`
- [ ] Static tests for hardening SQL
- [ ] Live isolation suite (adapted T1–T8 for current tables)
- [ ] AUDIT-R2 task record + freeze acceptance residual update

## Non-goals

- Creating organizations/memberships/sessions tables
- NestJS domain controllers
- Full formal freeze signatures
