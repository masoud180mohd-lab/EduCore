# IMP-051 — Platform Operations Phase 1a

## Outcome

Ship the first product surface for Platform Super Admin: tenant lifecycle, manual plan assignment, entitlement flags, and platform audit — API + `/platform` UI. Owner GO in session 2026-08-15 (SOLO-GOV-003). Production / public pilot remains **NO GO**.

## Status

**Complete** for the Phase 1a freeze set (ACF-PLAT-001 · DBF-PLAT-001 · DSF-007). Support sessions, metering, invoicing, Head/Student portals, and portal-preference persistence are out of this slice.

## Delivered

| Area | What landed |
| --- | --- |
| Persistence | Dedicated `educore_platform` Nest pool (`EDUCORE_PLATFORM_DATABASE_URL` / local default when `EDUCORE_ENABLE_APP_DB=1`). Writes use `withPlatformTransaction`. |
| HTTP | `/api/v1/platform/*` behind `RequirePlatformOperator` (no `X-Tenant-Id`; MFA step-up on writes). |
| Auth | `GET /auth/me` returns `platformOperator`. Login routes operators to `/platform` before tenant bind (D2). |
| Seed | `npm run seed:admin` grants `platform_operators` via migrator/ops URL (`DATABASE_URL`). `educore_platform` cannot INSERT that table. |
| Web | `PlatformShell` + schools list/register/detail + audit. EN/SW catalog. Identity tint `#134a6d`. |

## Honesty

- Global `NoopAuditPublisher` is unchanged. Platform writes persist `audit_events` inside the platform transaction (NULL `tenant_id` cannot use the educore_app insert policy).
- Platform-only users with **no** tenant membership still cannot complete password login (session row requires a tenant). Seed admin has both membership and operator grant.
- Portal switcher / last-portal preference (DSF-KIT-002 §5) is not implemented; Office link appears only when the session already has a tenant id.
