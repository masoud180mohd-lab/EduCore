# IMP-001 P16 — `POST /api/v1/organizations` (create)

## Outcome

Gated product write: create an organization in the session-bound tenant with `organization.manage`, required Idempotency-Key, and audit event.

## Status

**Complete** (2026-07-20).

## Endpoint

| Method | Path                    | AuthZ                                | Idempotency  |
| ------ | ----------------------- | ------------------------------------ | ------------ |
| `POST` | `/api/v1/organizations` | `organization.manage` + session bind | **Required** |

Body: `CreateOrganizationRequest` — `orgType`, `name`, optional `code`, optional `parentOrganizationId`.  
`tenantId` always from `X-Tenant-Id` (never body). Default `status=active`.

Success: `201 OrganizationEnvelope`.

## DB write path

SECURITY DEFINER `app.create_organization` (`20260720150000_org_create_user_patch_helpers`).  
`educore_app` remains SELECT-only on `organizations` table grants.

## Non-goals

PATCH/DELETE org, deactivate, other BC writes.

## Verification

```bash
npm run check
```

## Related

- GET list/detail: P6 / P7
- Prior writes: P14 settings, P15 invite
