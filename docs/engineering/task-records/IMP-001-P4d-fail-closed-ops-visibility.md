# IMP-001 P4d — Fail-Closed Ops Visibility (warn on AuthZ DB errors)

## Outcome

Close the **Medium** review finding: fail-closed AuthZ/membership DB paths returned empty/deny
silently, so outages looked identical to “no permission / no membership.”

## Status

**Complete** (2026-07-16).

## Resolution

| Component                   | Behavior on DB error                                        |
| --------------------------- | ----------------------------------------------------------- |
| `PgPermissionSource`        | Still returns empty `Set` (deny); **warn** via `APP_LOGGER` |
| `PgTenantMembershipChecker` | Still returns `false` (deny); **warn**                      |
| `RbacReadRepository`        | Still returns `[]`; **warn**                                |

Shared helper: `apps/api/src/common/logging/fail-closed-log.ts` — truncates message, no secrets,
no connection URLs, no stacks.

`RequestPlatformModule` factories inject `APP_LOGGER` into Pg sources.

## Non-goals

- Changing deny-by-default semantics
- Opening privileged business routes
- Shipping metrics/alerting stack (logger warn only)

## Verification

```bash
npx vitest run apps/api/src/common/logging/fail-closed-log.test.ts \
  apps/api/src/common/policy/pg-permission.source.test.ts \
  apps/api/src/common/tenant/pg-tenant-membership.checker.test.ts \
  apps/api/src/modules/identity-and-access/rbac/rbac-read.repository.test.ts
npm run check
```

## Related

- [IMP-001-P4-rbac-foundation.md](./IMP-001-P4-rbac-foundation.md)
- [IMP-001-P4c-auth-me-rbac-consistency.md](./IMP-001-P4c-auth-me-rbac-consistency.md)
