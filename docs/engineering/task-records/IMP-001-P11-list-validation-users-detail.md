# IMP-001 P11 — List cursor validation + users hardening

## Outcome

AUDIT-R4 **Medium** hardening for list reads:

1. **Cursor validation** — invalid cursor → `400 VALIDATION_ERROR` (not silent empty page).
2. **Users cursor keyset** — cursor subquery scoped to bound tenant + membership statuses.
3. **ACF Q5 semantics** — `status=invited` uses invited `tenant_memberships` rows.

## Status

**Complete** (2026-07-20).

## Change

| Area                   | Detail                                                               |
| ---------------------- | -------------------------------------------------------------------- |
| `parsePaginationQuery` | Cursor must be UUID when present                                     |
| Repositories           | Removed silent invalid-cursor empty pages (orgs, memberships, users) |
| `UsersRepository`      | `membershipStatuses` param; tenant-scoped cursor subquery            |
| `UsersService`         | `resolveMembershipStatuses()` for Q5                                 |

## Files

- `apps/api/src/common/pagination/cursor-pagination.ts`
- `apps/api/src/modules/*/repositories/*.repository.ts` (orgs, memberships, users)
- `apps/api/src/modules/identity-and-access/application/users.service.ts`

## Related

- [AUDIT-R4-read-increments-review.md](./AUDIT-R4-read-increments-review.md)
- [IMP-001-P8-list-pagination-filtering.md](./IMP-001-P8-list-pagination-filtering.md)
