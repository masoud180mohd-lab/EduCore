# Plan: P7 Organization Detail + P7b Membership Detail

## Overview

Add two **read-only** get-by-id endpoints extending existing list surfaces. Same AuthZ stack as lists; **404 no-enumeration** for missing / cross-tenant / invalid id / no pool (match `TenantsService.getForUser`).

## 404 decision table (CLAIM locked)

| Condition                                  | HTTP / code                   | Message style              |
| ------------------------------------------ | ----------------------------- | -------------------------- |
| Happy path (row in bound tenant under RLS) | 200 + `{ data }`              | —                          |
| Missing auth context                       | 401 `UNAUTHORIZED`            | existing                   |
| Missing tenant context                     | 400 `TENANT_CONTEXT_REQUIRED` | existing                   |
| Missing permission                         | 403 (RequirePermission)       | existing                   |
| Unknown id in tenant                       | 404 `NOT_FOUND`               | generic “not found”        |
| Other-tenant id / RLS null                 | 404 `NOT_FOUND`               | **same** message (no leak) |
| Invalid id shape (non-UUID)                | 404 `NOT_FOUND`               | same as tenants            |
| Pool unavailable / DB fail-closed null     | 404 `NOT_FOUND`               | same as tenants get        |

**Do not** use 403 for cross-tenant resource existence.

## Query sketches

**Org** (bound tenant + RLS via `withTenantTransaction`):

```sql
SELECT o.id, o.tenant_id, o.org_type, o.name, o.code, o.status,
       o.parent_organization_id, o.created_at, o.updated_at
FROM organizations o
WHERE o.tenant_id = $1::uuid AND o.id = $2::uuid
LIMIT 1
```

**Membership:**

```sql
SELECT m.id, m.tenant_id, m.user_id, m.status, m.joined_at,
       m.created_at, m.updated_at
FROM tenant_memberships m
WHERE m.tenant_id = $1::uuid AND m.id = $2::uuid
LIMIT 1
```

## Target files

### Task 1 — Organization get-by-id (S–M)

| File                                       | Change                                                 |
| ------------------------------------------ | ------------------------------------------------------ |
| `repositories/organizations.repository.ts` | `getByIdForTenant(userId, tenantId, id) → row \| null` |
| `application/organizations.service.ts`     | `getForTenant` → `{ data }` or `AppError.notFound`     |
| `controllers/organizations.controller.ts`  | `@Get(':id')` + same guard; header comment             |
| `*.test.ts` (3)                            | happy + 401 + tenant missing + 404 cases               |
| `IMP-001-P7-organizations-get-by-id.md`    | task record                                            |

**Param:** `:id` (Nest style; ACF name organizationId documented in task record).

**Envelope:** `{ data: Organization }` (same fields as list item).

### Task 2 — Membership get-by-id (S–M)

Same pattern under `identity-and-access` with `user.read`; task record `IMP-001-P7b-memberships-get-by-id.md`.

## Order

1. Org detail → check → commit
2. Membership detail → check → commit
3. Final check + report

## Out of scope

Writes, list pagination changes, nested user on membership, frontend.
