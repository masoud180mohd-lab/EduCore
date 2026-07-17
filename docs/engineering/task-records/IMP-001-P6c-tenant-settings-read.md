# IMP-001 P6c — Product Increment: `GET /api/v1/tenant-settings`

## Outcome

Open the **tenant settings document** product read under ADR-012 / conditional freeze: return the versioned settings document for the session-bound tenant with `tenant.read`.

## Status

**Complete** (2026-07-17).

## Endpoint

| Method | Path                      | Auth   | Header                     | AuthZ                                                                                        |
| ------ | ------------------------- | ------ | -------------------------- | -------------------------------------------------------------------------------------------- |
| `GET`  | `/api/v1/tenant-settings` | Bearer | **`X-Tenant-Id` required** | `RequirePermission('tenant.read')` → session↔header bind + membership-aware permission + RLS |

**Response (200):**

```json
{
  "data": {
    "schemaVersion": 1,
    "settings": {},
    "updatedAt": "…"
  }
}
```

**Missing document:** `404` `NOT_FOUND` — no silent empty invent; no auto-create. OpenAPI ACF previously omitted 404; this increment defines and tests 404.

## Schema prerequisite

`tenant_settings` was **not** present. Added:

- `apps/api/db/migrations/20260717020000_tenant_settings.up.sql`
- DBF-001 columns + additive `schema_version integer NOT NULL DEFAULT 1` (ACF envelope)
- FORCE RLS Pattern A; **SELECT-only** for `educore_app`
- `updated_by_user_id` stored but **not** returned (not in public ACF shape)

## Implementation

| Layer      | Path                                                            |
| ---------- | --------------------------------------------------------------- |
| Controller | `tenant-and-billing/controllers/tenant-settings.controller.ts`  |
| Service    | `tenant-and-billing/application/tenant-settings.service.ts`     |
| Repository | `tenant-and-billing/repositories/tenant-settings.repository.ts` |
| RLS tx     | `withTenantTransaction`                                         |

## Explicit non-goals

- `PUT /tenant-settings` (write closed)
- Settings schema validation on write
- Entitlements / subscriptions reads

## Security

- Auth + tenant + session bind + `tenant.read`.
- Only public settings shape returned (`schemaVersion`, `settings`, `updatedAt`).
- Fail-closed 404 without pool / missing row / DB errors.

## Verification

```bash
npm run check
```

## Related

- ACF-001 §4.4 Tenant settings
- Plan: `tasks/plan-read-increments-orgs-memberships-settings.md`
- Prior: P6 organizations, P6b memberships
