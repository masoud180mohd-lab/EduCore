# IMP-001 P8 — List pagination + filtering (organizations + memberships)

## Outcome

Harden product **list** reads with explicit cursor pagination metadata and richer optional filters, without changing AuthZ or opening writes.

## Status

**Complete** (2026-07-17).

## Baseline (already present from P6 / P6b)

Both list endpoints already returned ACF page envelopes and supported `limit` / `cursor` / `status` via `common/pagination/cursor-pagination.ts`.

## What this increment adds

### `GET /api/v1/organizations`

| Query     | Behavior                                                                                |
| --------- | --------------------------------------------------------------------------------------- |
| `limit`   | 1–100, default **25** (optional; defaults apply)                                        |
| `cursor`  | Opaque last-page org `id` (uuid keyset on `(name, id)`)                                 |
| `status`  | `active` \| `inactive`                                                                  |
| `orgType` | **New** — `school` \| `campus` \| `department`                                          |
| `search`  | **New** — case-insensitive substring on `name` / `code` (ILIKE, metacharacters escaped) |

**Response (unchanged shape):**

```json
{
  "data": [/* Organization */],
  "page": { "nextCursor": null, "limit": 25 }
}
```

### `GET /api/v1/memberships`

| Query    | Behavior                                                 |
| -------- | -------------------------------------------------------- |
| `limit`  | 1–100, default **25**                                    |
| `cursor` | last membership `id` (keyset on `(created_at, id)`)      |
| `status` | `invited` \| `active` \| `suspended` \| `removed`        |
| `userId` | **New** — filter roster to one user uuid in bound tenant |

Same `{ data, page }` envelope.

## AuthZ (unchanged)

- Organizations: `RequirePermission('organization.read')` + session bind + RLS Pattern A
- Memberships: `RequirePermission('user.read')` + session bind + RLS

No write routes.

## Implementation files

| Area        | Paths                                                      |
| ----------- | ---------------------------------------------------------- |
| Orgs        | `organizations.{controller,service,repository}.ts` + tests |
| Memberships | `memberships.{controller,service,repository}.ts` + tests   |

## Verification

```bash
npm run check
```

## Related

- [IMP-001-P6-organizations-list-read.md](./IMP-001-P6-organizations-list-read.md)
- [IMP-001-P6b-memberships-list-read.md](./IMP-001-P6b-memberships-list-read.md)
- ACF-001 list envelopes / `PageInfo`
