# IMP-001 P5 — First Product Increment: `GET /api/v1/tenants`

## Outcome

Open the first **read-only product** Identity/Tenant HTTP surface under **ADR-012** (solo operator / conditional freeze): list tenants the authenticated user can access via **active membership**.

## Status

**Complete** (2026-07-16).

## Endpoint

| Method | Path              | Auth                        | AuthZ                                                                         |
| ------ | ----------------- | --------------------------- | ----------------------------------------------------------------------------- |
| `GET`  | `/api/v1/tenants` | Bearer (`RequireAuthGuard`) | Active membership implied by RLS `can_see_tenant` (no `X-Tenant-Id` required) |

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "code": "demo-school",
      "name": "Demo School",
      "status": "active",
      "primaryLocale": "en",
      "timezone": "Africa/Dar_es_Salaam",
      "createdAt": "…",
      "updatedAt": "…"
    }
  ]
}
```

Empty `data: []` when: no memberships, pool disabled (CI), or RLS denies all rows.

## Implementation

| Layer      | Path                                                                        |
| ---------- | --------------------------------------------------------------------------- |
| Controller | `tenant-and-billing/controllers/tenants.controller.ts`                      |
| Service    | `tenant-and-billing/application/tenants.service.ts`                         |
| Repository | `tenant-and-billing/repositories/accessible-tenants.repository.ts`          |
| RLS helper | `common/persistence/user-rls-transaction.ts` — sets `app.current_user` only |

Visibility uses existing **Pattern B** policy: `USING (app.can_see_tenant(id))` with membership via `app.user_has_active_membership`.

## Explicit non-goals

- `POST` / `PATCH` / `DELETE` tenants
- `GET /tenants/{id}` / `GET /tenants/current`
- Role-admin, user management
- Cursor pagination (memberships are typically small; add later if needed)

## Contract note

ACF-001 OpenAPI currently documents `POST /tenants` and `GET /tenants/{tenantId}` but not a principal-scoped list. This increment implements the practical **“my tenants”** read used by login/tenant-picker UX. Freeze alignment (OpenAPI amendment) remains a follow-up under formal Freeze v1.0.

## Security

- Authenticated only; no anonymous access.
- No cross-user listing (GUC = caller `userId`).
- App pool still cannot INSERT/UPDATE/DELETE tenants (AUDIT-R2).
- Fail-closed empty list without pool (CI-safe).

## Verification

```bash
npm run check
```

## Related

- AuthN: P3 `/auth/me` memberships summaries
- RBAC: P4 / P4b / P4c
- Governance: ADR-012 conditional freeze
