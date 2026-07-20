# IMP-003-P4 — `GET /api/v1/terms/{id}` (Term Detail)

## Outcome

Open term **detail** under DBF-004 / ACF-004 rev 1.1: return one term in the session-bound tenant with `academic.read`. Missing / cross-tenant / invalid id / fail-closed → **404** `Term not found.` (no existence leak).

## Status

**Complete** (2026-07-21). Freezes: ACF-004 amended to rev 1.1 (solo-operator provisional).

## Endpoint

| Method | Path                 | AuthZ                                               |
| ------ | -------------------- | --------------------------------------------------- |
| `GET`  | `/api/v1/terms/{id}` | `RequirePermission('academic.read')` + session bind |

**operationId:** `getTerm`  
Response: same allowlist as list item (`TermEnvelope`).

## Implementation

| Layer      | Path                                         |
| ---------- | -------------------------------------------- |
| ACF        | `ACF-004-terms-list-slice.md` rev **1.1**    |
| Repository | `terms.repository.ts` → `getByIdForTenant`   |
| Service    | `terms.service.ts` → `getForTenant`          |
| Controller | `@Get(':id')` after list `@Get()`            |
| Migration  | **None** — reuses DBF-004 table + SELECT RLS |

## Security

- Cross-tenant id → 404 (never 403 that proves existence)
- Invalid UUID / missing / no pool / DB error → same 404 surface
- Parameterized SQL: `tenant_id = $bound AND id = $id`
- Field allowlist unchanged from list
- No `term.read` invention

## Non-goals

Field expansion, nested academicYear, writes, schema change.

## Related

- List: [IMP-003-P3-terms-list-read.md](./IMP-003-P3-terms-list-read.md)
- Twin: [IMP-003-P1-academic-years-get-by-id.md](./IMP-003-P1-academic-years-get-by-id.md)
