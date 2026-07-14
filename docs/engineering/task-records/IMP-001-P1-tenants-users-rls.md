# IMP-001 Phase P1 — Tenants + Users + First RLS Policies

## Outcome

Add DBF-001 root tables `tenants` and `users` with FORCE RLS and first Pattern B/C policies for `educore_app`, without memberships/sessions/controllers.

## Status

**Complete** for this increment.

## Tasks addressed

| ID                 | Scope                                    | Status                                            |
| ------------------ | ---------------------------------------- | ------------------------------------------------- |
| IMP-001-T06        | `tenants` + `users` DDL                  | Done                                              |
| IMP-001-T10        | First real policies on tenant/user roots | Extended (still incomplete for full matrix T1–T8) |
| tenant_memberships | Deferred (membership hook returns false) | Deferred                                          |
| IMP-001-T11        | Automated isolation suite                | Next                                              |

## Migrations

| ID                                 | Purpose                               |
| ---------------------------------- | ------------------------------------- |
| `20260714150000_tenants_and_users` | Table DDL + grants                    |
| `20260714160000_tenants_users_rls` | Helpers + ENABLE/FORCE RLS + policies |

## RLS design (this increment)

| Object                               | Behaviour                                                               |
| ------------------------------------ | ----------------------------------------------------------------------- |
| `app.can_see_tenant(id)`             | `current_tenant` match **or** platform/bootstrap **or** membership hook |
| `app.user_has_active_membership(id)` | **Always false** until `tenant_memberships` exists                      |
| `app.can_see_user(id)`               | Self (`current_user`) **or** platform/bootstrap                         |
| tenants INSERT                       | platform/bootstrap only                                                 |
| users INSERT                         | platform/bootstrap only                                                 |
| DELETE                               | No policy for `educore_app` (deny)                                      |

## Skills applied

| Skill                       | Application                                               |
| --------------------------- | --------------------------------------------------------- |
| planning-and-task-breakdown | Only T06 roots; memberships deferred explicitly           |
| incremental-implementation  | Two migrations; membership-ready hooks                    |
| spec-driven-development     | Columns/checks from DBF-001                               |
| security-and-hardening      | FORCE RLS, deny DELETE, fail-closed membership hook       |
| code-review-and-quality     | Structural SQL tests                                      |
| api-and-interface-design    | No API yet; GUC contract matches ACF tenant/session model |

## Security notes

- Without memberships, cross-tenant user listing via membership is impossible (hook false) — intentional.
- Platform/bootstrap GUCs must be set only by trusted app middleware (P2); never from client headers directly.
- `password_hash` column exists but must never be selected into API DTOs (P3+).

## Verification

```bash
npm run check
```

Optional:

```bash
npm run docker:up
npm run db:migrate
```

## Recommended next step

**IMP-001-T11-style isolation tests** (and/or introduce `tenant_memberships` then re-define `app.user_has_active_membership` and extend `app.can_see_user`).
