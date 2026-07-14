# IMP-001 P1 Continuation — tenant_memberships + OpenAPI Hardening

## Outcome

Under **conditional freeze**, implement the `tenant_memberships` table with working RLS, replace membership stub helpers with real `SECURITY DEFINER` lookups, and harden ACF-001 OpenAPI with security schemes + `x-permissions` / `x-authz` metadata. **No domain HTTP controllers.**

## Status

**Complete** (conditional freeze scope).

## Deliverables

### Database

| Migration                               | Purpose                           |
| --------------------------------------- | --------------------------------- |
| `20260714180000_tenant_memberships`     | Table DDL, FKs, indexes, grants   |
| `20260714190000_membership_rls_helpers` | FORCE RLS, policies, real helpers |

### Helpers (now real)

| Function                                        | Behaviour                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------ |
| `app.user_has_active_membership(tenant_id)`     | `EXISTS` active membership for `app.current_user` (**SECURITY DEFINER**) |
| `app.user_is_member_of_current_tenant(user_id)` | Active member of `app.current_tenant` (**SECURITY DEFINER**)             |
| `app.can_see_user`                              | Self **or** trusted platform **or** same-tenant active member            |
| `app.can_see_tenant`                            | Current tenant GUC **or** trusted platform **or** active membership      |

### OpenAPI

- `components.securitySchemes`: `bearerAuth`, `tenantHeader` (`X-Tenant-Id`)
- Default `security: [bearerAuth]`
- Per-operation `security`, `x-permissions`, `x-authz`
- `components.x-permission-catalogue` lists DBF-001 seed codes
- Info description marks **CONDITIONAL** acceptance

### Tests / docs

- `tests/tooling/p1-tenant-memberships.test.ts`
- Live suite membership case in `tests/isolation/tenant-rls.live.test.ts`
- This task record

## Skills applied

| Skill                       | Use                                                   |
| --------------------------- | ----------------------------------------------------- |
| planning-and-task-breakdown | Schema first, then helpers, then OpenAPI, no routes   |
| incremental-implementation  | Two migrations + OpenAPI script                       |
| spec-driven-development     | DBF-001 membership columns; ACF permission codes      |
| api-and-interface-design    | securitySchemes + x-permissions                       |
| security-and-hardening      | SECURITY DEFINER anti-recursion; INSERT only platform |
| code-review-and-quality     | Structural + live tests                               |

## Security notes

- Membership INSERT reserved for **`educore_platform`** + trusted GUCs (same model as tenant/user create).
- Runtime **`educore_app`**: SELECT/UPDATE memberships in tenant (or own rows); no INSERT/DELETE.
- GUC spoofing still cannot elevate to platform (AUDIT-R2).
- App middleware (future) must not set `app.current_tenant` without verifying membership.

## Explicit non-goals confirmed

- No NestJS membership/tenant/user controllers
- No Design System / PLAT-004
- No claim of full freeze v1.0 acceptance

## Verification

```bash
npm run check
# with Postgres:
npm run db:migrate
$env:RUN_LIVE_DB_TESTS='1'
npm run test -- tests/isolation/tenant-rls.live.test.ts
```

## Recommended next step

1. Human freeze signature ceremony (or keep conditional)
2. Isolation matrix expansion + optional membership invite **service** (still no wide API surface)
3. Only then Phase P2 request platform / auth routes under accepted freezes
