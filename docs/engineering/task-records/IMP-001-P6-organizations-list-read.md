# IMP-001 P6 — Product Increment: `GET /api/v1/organizations`

## Outcome

Open the **organizations list** product read under ADR-012 / conditional freeze: list organizations for the session-bound tenant with `organization.read`.

## Status

**Complete** (2026-07-17).

## Endpoint

| Method | Path                    | Auth   | Header                     | AuthZ                                                                                                        |
| ------ | ----------------------- | ------ | -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `GET`  | `/api/v1/organizations` | Bearer | **`X-Tenant-Id` required** | `RequirePermission('organization.read')` → session↔header bind + membership-aware permission + RLS Pattern A |

**Query (ACF):**

| Param    | Notes                             |
| -------- | --------------------------------- |
| `limit`  | 1–100, default 25                 |
| `cursor` | Opaque; last page org `id` (uuid) |
| `status` | Optional: `active` \| `inactive`  |

**Response (200):**

```json
{
  "data": [
    {
      "id": "uuid",
      "tenantId": "uuid",
      "orgType": "school",
      "name": "…",
      "code": "…",
      "status": "active",
      "parentOrganizationId": null,
      "createdAt": "…",
      "updatedAt": "…"
    }
  ],
  "page": { "nextCursor": null, "limit": 25 }
}
```

Empty `data: []` when: no rows, pool disabled (CI), invalid cursor shape, or RLS denies.

## Schema prerequisite

`organizations` table was **not** present before this increment. Added:

- `apps/api/db/migrations/20260717010000_organizations.up.sql`
- DBF-001 columns + partial unique `(tenant_id, code)` + indexes
- FORCE RLS Pattern A: `tenant_id = app.current_tenant_id()` for `educore_app`
- **SELECT-only** grants for `educore_app` (no app writes)

## Implementation

| Layer      | Path                                                                     |
| ---------- | ------------------------------------------------------------------------ |
| Controller | `tenant-and-billing/controllers/organizations.controller.ts`             |
| Service    | `tenant-and-billing/application/organizations.service.ts`                |
| Repository | `tenant-and-billing/repositories/organizations.repository.ts`            |
| RLS tx     | `withTenantTransaction` (sets `app.current_tenant` + `app.current_user`) |

## Explicit non-goals

- `POST` / `PATCH` / deactivate organization
- `GET /organizations/{id}`
- Nested write surfaces

## Security

- Auth + tenant header + session bind + `organization.read`.
- Data scoped by bound tenant GUC / RLS; client cannot select another tenant’s rows via query alone.
- Fail-closed empty page without pool / on DB errors.

## Verification

```bash
npm run check
```

## Related

- ACF-001 §4.3 Organizations
- Pattern anchors: P5 / P5b / P5c tenants reads
- Plan: `tasks/plan-read-increments-orgs-memberships-settings.md`
