# IMP-003-P3 — First Terms Product Read: `GET /api/v1/terms`

## Naming choice

**Task ID:** `IMP-003-P3` (Academic Structure series; follows years P0–P2).

## Outcome

Open the first **Terms** product **READ** under Academic Structure: list terms for the session-bound tenant with `academic.read`, optional parent `academicYearId` filter, cursor pagination (`starts_on ASC NULLS LAST, id ASC`), and `status` / `search` filters.

## Status

**Complete** (2026-07-20). Freezes accepted solo-operator provisional.

## Freezes

| Artifact | Path                                                               |
| -------- | ------------------------------------------------------------------ |
| DBF-004  | `docs/engineering/database-freeze/DBF-004-terms-list-slice.md`     |
| ACF-004  | `docs/engineering/api-contract-freeze/ACF-004-terms-list-slice.md` |

## Locked decisions (D1–D10)

| #   | Lock                                                       |
| --- | ---------------------------------------------------------- |
| D1  | Flat path `GET /api/v1/terms` (not nested under years)     |
| D2  | Optional `academicYearId` UUID filter (bound tenant only)  |
| D3  | Reuse `academic.read` — no `term.read`                     |
| D4  | Status `draft` \| `active` \| `closed`                     |
| D5  | Optional dates; both set ⇒ ends ≥ starts                   |
| D6  | Order `starts_on ASC NULLS LAST, id ASC`                   |
| D7  | Opaque keyset cursor on last row `id`                      |
| D8  | FK `academic_year_id` + denormalized `tenant_id` Pattern A |
| D9  | Writes closed                                              |
| D10 | `educore_app` SELECT only                                  |

## Doubt check (documented)

| Risk                                  | Resolution                                                                  |
| ------------------------------------- | --------------------------------------------------------------------------- |
| Cross-tenant `academicYearId`         | Valid UUID + missing/other-tenant year → **empty page** (no existence leak) |
| Invalid (non-UUID) `academicYearId`   | **400** `VALIDATION_ERROR` — strict filter, not silent empty                |
| Permission invention                  | Reuse `academic.read`; no seed of `term.*`                                  |
| Nested vs flat path                   | Flat `/terms` for v1 parity with years/students                             |
| Parent year tenant mismatch on writes | Out of scope P3; future write helper must bind `term.tenant_id` to parent   |

## Endpoint

| Method | Path            | AuthZ                                               |
| ------ | --------------- | --------------------------------------------------- |
| `GET`  | `/api/v1/terms` | `RequirePermission('academic.read')` + session bind |

### Query

`limit`, `cursor`, `academicYearId`, `status`, `search`.

### Response

`TermListEnvelope`: allowlisted fields only  
(`id`, `tenantId`, `academicYearId`, `name`, `code`, `startsOn`, `endsOn`, `status`, `createdAt`, `updatedAt`).

## Implementation

| Layer      | Path                                                 |
| ---------- | ---------------------------------------------------- |
| Migration  | `20260720200000_terms_list_read`                     |
| Controller | `academic-structure/controllers/terms.controller.ts` |
| Service    | `application/terms.service.ts`                       |
| Repository | `repositories/terms.repository.ts`                   |
| Permission | Reuse `academic.read` (no new catalogue row)         |

## Explicit non-goals

- Term writes (POST/PATCH/DELETE), GET by id
- Nested `/academic-years/:id/terms`
- classes, streams, subjects, enrollments
- New permission codes

## Residual risks

- Solo-operator freeze lacks independent peer review
- Empty list until platform seed / future term create writes
- App must enforce `term.tenant_id = year.tenant_id` on future writes (not DB trigger in P3)
- Live RLS isolation re-verify after migrate

## Verification

```bash
npm run check
```

## Related

- Parent years: [IMP-003-P0-academic-years-list-read.md](./IMP-003-P0-academic-years-list-read.md)
- Pattern twin: students list IMP-002-P0
