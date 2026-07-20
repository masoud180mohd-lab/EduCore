# IMP-001 P17 — `PATCH /api/v1/users/{id}` (displayName)

## Outcome

Gated product write: update `displayName` for a user visible in the bound tenant.

## Status

**Complete** (2026-07-20).

## AuthZ decision (ACF-aligned)

- **Self:** path `userId === auth.userId` → allow `displayName` only (after active membership + session bind).
- **Other:** requires `user.manage`.
- Guard: `RequireActiveMembershipGuard` (session bind + membership); manage-or-self enforced in `UsersService`.

## Endpoint

| Method  | Path                | Body                                            | Idempotency |
| ------- | ------------------- | ----------------------------------------------- | ----------- |
| `PATCH` | `/api/v1/users/:id` | `UpdateUserRequest` (`displayName` only, 1–120) | Optional    |

Missing / cross-tenant / not active member → **404**.  
`status` and unknown keys → **VALIDATION_ERROR** (no disable via this route).

## DB write path

SECURITY DEFINER `app.update_user_display_name` — RLS would block non-self UPDATE for `educore_app`.

## Non-goals

disable/status transitions, email/password/role changes, invite (P15).

## Verification

```bash
npm run check
```

## Related

- GET list/detail: P9 / P12
