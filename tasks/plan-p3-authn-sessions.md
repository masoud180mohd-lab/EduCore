# Implementation Plan: IMP-001 Phase P3 — AuthN Sessions & Login

## Overview

Database-backed sessions, real `TokenValidator`, and gated auth endpoints (`login` / `refresh` / `logout`) under ADR-012. No tenant/user CRUD routes. MFA deferred.

## Architecture Decisions

1. **Opaque server sessions** (not JWT): access + refresh secrets hashed at rest (`session_token_hash`, `refresh_token_hash`).
2. **DBF-001 sessions** require `tenant_id` — login binds an active membership tenant (body `tenantId`, `X-Tenant-Id`, or sole membership).
3. **SECURITY DEFINER auth helpers** for pre-auth lookup (email → credentials) and token hash lookup so `educore_app` never needs RLS-bypass GUCs for login.
4. **Password hashing:** Node `scrypt` (no new dependency); never log hashes/tokens.
5. **TokenValidator:** `SessionTokenValidator` when `PG_POOL` enabled; else `RejectAllTokenValidator`.
6. **Routes only under** `/api/v1/auth/*` — identity module owns them (ADR-001).

## Task Order

1. Migration `sessions` + auth helpers + RLS
2. Password/token utilities + session repository
3. Auth application service (login/refresh/logout)
4. Controller + wire TokenValidator
5. Tests + task record + `npm run check`

## Non-Goals

- MFA verify, `/auth/me`, select-tenant, session list/revoke admin
- Full RBAC admin APIs
- IdP/OIDC assertion path (stub reject for now)
