# IMP-001 P6b — Product Increment: `GET /api/v1/memberships`

## Outcome

Open the **tenant memberships list** product read under ADR-012 / conditional freeze: list memberships for the session-bound tenant with `user.read`.

## Status

**Complete** (2026-07-17).

## AuthZ decision (doubt-driven)

| Claim                                                        | Contract                                                        |
| ------------------------------------------------------------ | --------------------------------------------------------------- |
| List is **tenant-scoped roster** for the bound `X-Tenant-Id` | ACF-001 §4.6 `GET /memberships` — Bearer + tenant + `user.read` |
| Not “my memberships across tenants”                          | That remains `/auth/me` membership summaries (P3/P4c)           |

**Adversarial check:** Returning only the caller’s row would break admin/staff directory UX implied by `user.read`. Cross-tenant “mine” without tenant header would invent a third list shape. **Locked:** bound-tenant list only.

## Endpoint

| Method | Path                  | Auth   | Header                     | AuthZ                                                                                      |
| ------ | --------------------- | ------ | -------------------------- | ------------------------------------------------------------------------------------------ |
| `GET`  | `/api/v1/memberships` | Bearer | **`X-Tenant-Id` required** | `RequirePermission('user.read')` → session↔header bind + membership-aware permission + RLS |

**Query:**

| Param    | Notes                                                       |
| -------- | ----------------------------------------------------------- |
| `limit`  | 1–100, default 25                                           |
| `cursor` | Opaque; last page membership `id` (uuid)                    |
| `status` | Optional: `invited` \| `active` \| `suspended` \| `removed` |

**Response (200):**

```json
{
  "data": [
    {
      "id": "uuid",
      "tenantId": "uuid",
      "userId": "uuid",
      "status": "active",
      "joinedAt": "…",
      "createdAt": "…",
      "updatedAt": "…"
    }
  ],
  "page": { "nextCursor": null, "limit": 25 }
}
```

Nested `user` expansion deferred (core Membership fields only).

## Implementation

| Layer      | Path                                                         |
| ---------- | ------------------------------------------------------------ |
| Controller | `identity-and-access/controllers/memberships.controller.ts`  |
| Service    | `identity-and-access/application/memberships.service.ts`     |
| Repository | `identity-and-access/repositories/memberships.repository.ts` |
| Table      | Existing `tenant_memberships` (P1) + RLS (`190000`)          |
| RLS tx     | `withTenantTransaction`                                      |

## Explicit non-goals

- Invite / suspend / reactivate / remove
- `GET /memberships/{id}`
- Cross-tenant membership listing
- Nested user profile payload

## Security

- Auth + tenant + session bind + `user.read`.
- Queries run with bound tenant GUC; RLS SELECT allows current tenant rows.
- Fail-closed empty page without pool / on DB errors.

## Verification

```bash
npm run check
```

## Related

- ACF-001 §4.6 Tenant memberships
- Plan: `tasks/plan-read-increments-orgs-memberships-settings.md`
- Prior: `IMP-001-P6-organizations-list-read.md`
