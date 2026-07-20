# IMP-003-P5 — `POST /api/v1/terms` (Term Create)

## Outcome

Open first Terms product **WRITE**: create a term under a parent academic year in the session-bound tenant with `academic.manage`, required Idempotency-Key, SECURITY DEFINER helper (table INSERT stays REVOKED), and parent-year same-tenant check.

## Status

**Complete** (2026-07-21). Freezes: DBF-004 rev **1.1**, ACF-004 rev **1.2** (solo-operator provisional).

## Freezes

| Artifact | Path / rev                                                |
| -------- | --------------------------------------------------------- |
| DBF-004  | `DBF-004-terms-list-slice.md` rev **1.1** (create helper) |
| ACF-004  | `ACF-004-terms-list-slice.md` rev **1.2** (`createTerm`)  |

## Endpoint

| Method | Path            | AuthZ                                                 | Idempotency  |
| ------ | --------------- | ----------------------------------------------------- | ------------ |
| `POST` | `/api/v1/terms` | `RequirePermission('academic.manage')` + session bind | **Required** |

**operationId:** `createTerm`  
Response **201** `TermEnvelope` (same allowlist as list/detail).

### Body allowlist

`academicYearId` (required UUID), `name` (1–200), `code?`, `startsOn?`, `endsOn?`, `status?` (default **draft**).  
`tenantId` never from body.

### Parent year

Missing / other-tenant year → **400** `VALIDATION_ERROR`  
Message: `academicYearId not found in this tenant.`  
(Helper: `EXISTS year WHERE id AND tenant_id = bound`.)

### Conflicts

Duplicate code per (tenant, year) → **409** `CONFLICT`.

## Implementation

| Layer      | Path                                                          |
| ---------- | ------------------------------------------------------------- |
| Migration  | `20260720210000_terms_create` — `app.create_term` only        |
| Repository | `createForTenant` → helper                                    |
| Service    | `createForTenant` + parse + idempotency + audit `term.create` |
| Controller | `@Post()` after list, before `:id`; `academic.manage`         |
| Permission | Reuse `academic.manage` (no new seed)                         |

## Security

- Table INSERT remains REVOKED for `educore_app`
- Staff cannot create (no `academic.manage` on staff)
- Parent year tenant-bound inside helper
- No `term.manage` invention

## Non-goals

PATCH/DELETE, classes/streams, nested year path, new permission codes.

## Related

- List: [IMP-003-P3-terms-list-read.md](./IMP-003-P3-terms-list-read.md)
- Detail: [IMP-003-P4-terms-get-by-id.md](./IMP-003-P4-terms-get-by-id.md)
- Twin: [IMP-003-P2-academic-years-create.md](./IMP-003-P2-academic-years-create.md)
