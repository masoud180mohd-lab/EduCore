# IMP-001 P14 — `PUT /api/v1/tenant-settings` (replace settings)

## Outcome

Open **gated** product write under solo-operator governance: replace (UPSERT) the bound-tenant settings document with `tenant.manage`. Reads preserved. No other write routes.

## Status

**Complete** (2026-07-20).

## Freezes / authority

| Artifact                                   | Role                                         |
| ------------------------------------------ | -------------------------------------------- |
| FREEZE_ACCEPTANCE_IDENTITY_TENANT v1.0     | Writes **NO GO** except gated IMP increments |
| This task prompt                           | Gates **W1 only** for settings PUT           |
| ACF-001 §4.4 / OpenAPI `putTenantSettings` | Contract                                     |
| DBF-001 `tenant_settings`                  | Data + RLS Pattern A                         |

## Endpoint

| Method | Path                      | Auth   | Header                 | AuthZ                                               |
| ------ | ------------------------- | ------ | ---------------------- | --------------------------------------------------- |
| `PUT`  | `/api/v1/tenant-settings` | Bearer | `X-Tenant-Id` required | `RequirePermission('tenant.manage')` + session bind |

### Body (`TenantSettingsWrite`)

- `schemaVersion` integer ≥ 1 (required)
- `settings` object (required)
- Unknown top-level keys → `VALIDATION_ERROR`

### Success

`200` `{ data: { schemaVersion, settings, updatedAt } }`

### Semantics

**UPSERT** via SECURITY DEFINER `app.replace_tenant_settings` (missing row creates document). Prefer PUT DX over GET-style 404.

### Idempotency

Optional `Idempotency-Key`. When present: scope `actor + tenant + PUT + route + key`; replay same body; different body → `IDEMPOTENCY_KEY_REUSE_MISMATCH`.

## DB write path

- `educore_app` remains **SELECT-only** on `tenant_settings` table grants.
- Migration `20260720140000_product_write_helpers`: `app.replace_tenant_settings` SECURITY DEFINER + `EXECUTE` to `educore_app`.
- Nest uses `withTenantTransaction` GUCs; helper re-checks active membership.

## Implementation

| Layer      | Path                                                       |
| ---------- | ---------------------------------------------------------- |
| Controller | `tenant-settings.controller.ts` `@Put()`                   |
| Service    | `putForTenant` + validation + optional idempotency + audit |
| Repository | `replaceForTenant` → helper                                |
| Audit      | `tenant_settings.put` via platform-operations barrel       |

## Explicit non-goals

- PATCH/DELETE settings
- Full nested JSON Schema catalogue
- Redis idempotency store
- Opening other write routes

## Residual risks

- In-memory idempotency is single-process only.
- Audit publisher is Noop by default (still invoked).

## Verification

```bash
npm run check
```

## Related

- GET: [IMP-001-P6c-tenant-settings-read.md](./IMP-001-P6c-tenant-settings-read.md)
- Invite: [IMP-001-P15-memberships-create.md](./IMP-001-P15-memberships-create.md)
