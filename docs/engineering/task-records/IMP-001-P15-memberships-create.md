# IMP-001 P15 — `POST /api/v1/memberships` (invite member)

## Outcome

Open **gated** product write: invite a member by email into the session-bound tenant with `user.invite`. Creates/finds user; membership status **invited**; optional system `roleCodes`; required idempotency; audit event.

## Status

**Complete** (2026-07-20).

## Freezes / authority

| Artifact                                  | Role                           |
| ----------------------------------------- | ------------------------------ |
| FREEZE_ACCEPTANCE_IDENTITY_TENANT v1.0    | Writes gated only              |
| This task prompt                          | Gates **W2** membership invite |
| ACF-001 §4.6 / OpenAPI `createMembership` | Contract                       |
| DBF-001 memberships + users               | Data + RLS                     |

## Endpoint

| Method | Path                  | Auth   | Header                 | AuthZ                                             |
| ------ | --------------------- | ------ | ---------------------- | ------------------------------------------------- |
| `POST` | `/api/v1/memberships` | Bearer | `X-Tenant-Id` required | `RequirePermission('user.invite')` + session bind |

### Headers

- **`Idempotency-Key` required** (16–128 chars)

### Body (`CreateMembershipRequest`)

- `email` required (email format)
- `displayName` optional
- `roleCodes` optional: `owner` \| `admin` \| `staff` only

### Success

`201` `{ data: Membership }` (same core fields as list/detail)

### Errors

| Condition                            | Code                             |
| ------------------------------------ | -------------------------------- |
| Missing Idempotency-Key              | `IDEMPOTENCY_KEY_REQUIRED`       |
| Duplicate active/invited membership  | `CONFLICT`                       |
| Idempotency key reuse different body | `IDEMPOTENCY_KEY_REUSE_MISMATCH` |

## DB write path

- Table INSERT on `tenant_memberships` remains revoked for `educore_app`.
- Helpers: `app.invite_tenant_membership`, `app.assign_system_role_codes` (SECURITY DEFINER).
- Migration: `20260720140000_product_write_helpers`.

## Implementation

| Layer      | Path                                                                        |
| ---------- | --------------------------------------------------------------------------- |
| Controller | `memberships.controller.ts` `@Post()` `@HttpCode(201)` before `@Get(':id')` |
| Service    | `inviteForTenant` + required idempotency + audit                            |
| Repository | `inviteForTenant` → helpers                                                 |

### Audit

`membership.invite` success with `resourceType` membership, no secrets in metadata.

## Explicit non-goals

- suspend / reactivate / remove
- Custom (non-system) role assignment
- userId-only invite body (not in ACF)
- Redis idempotency

## Residual risks

- In-memory idempotency multi-instance.
- Email uniqueness race under concurrent invites (DB unique + 409).
- System roles must exist for tenant (seed/bootstrap) when `roleCodes` provided.
- Noop audit persistence.

## Verification

```bash
npm run check
```

## Related

- List/detail: P6b / P7b
- Settings write: [IMP-001-P14-tenant-settings-put.md](./IMP-001-P14-tenant-settings-put.md)
