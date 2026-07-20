# IMP-001 P13 — AUDIT-R4 Low polish (ILIKE helper + tenants picker policy)

## Outcome

Close AUDIT-R4 **Low** backlog:

1. **Shared ILIKE escape** — `escapeIlikePattern` / `parseOptionalSearchFilter` in `common/text`.
2. **Tenants picker policy** — document unpaginated `{ data }` envelope; soft safety cap (100) with warn on truncate.
3. **No full cursor pagination** on `GET /tenants` — deferred; picker cardinality stays low by design.

## Status

**Complete** (2026-07-20).

## Change

| Area                          | Detail                                  |
| ----------------------------- | --------------------------------------- |
| `common/text/ilike-escape.ts` | Shared escape + optional search parse   |
| Orgs / users services         | Use shared helper (no local duplicates) |
| `AccessibleTenantsRepository` | `LIMIT cap+1`, truncate to 100, warn    |
| OpenAPI / ACF                 | Picker unpaginated policy + rev 1.4     |

## Explicit non-goals

- Changing `TenantListEnvelope` to include `page`
- Admin-style paginated tenant catalogue
- Write routes

## Related

- [AUDIT-R4-read-increments-review.md](./AUDIT-R4-read-increments-review.md)
- [IMP-001-P5-tenants-list-read.md](./IMP-001-P5-tenants-list-read.md)
