# IMP-013 — Academic Structure PATCH

| Field     | Value                                                         |
| --------- | ------------------------------------------------------------- |
| Program   | **IMP-013**                                                   |
| Date      | 2026-07-24                                                    |
| Authority | Solo-operator provisional                                     |
| Contracts | ACF-003…007 rev 1.3; DSF-002 v1.2; DBF-003…007 update helpers |

## Goal

Operators can rename / set code & dates / change status (`draft` \| `active` \| `closed`) on academic structure entities from Admin detail pages. Closes the IMP-012 read-only gap without DELETE or FK reparenting.

## Waves

| Wave | Work                                               | Status |
| ---- | -------------------------------------------------- | ------ |
| 0    | ACF/OpenAPI/DSF/DBF amend + this record            | Done   |
| 1    | `app.update_*` SECURITY DEFINER helpers            | Done   |
| 2    | Nest PATCH controllers/services/repos + unit tests | Done   |
| 3    | Admin detail edit forms (five entities)            | Done   |
| 4    | Tooling + manual QA + `npm run check` + commit     | Done   |

## Endpoints

`PATCH /api/v1/{academic-years\|terms\|classes\|streams\|subjects}/{id}` + `academic.manage`  
Idempotency-Key **optional**.

## Allowlists

- **years/terms:** `name`, `code` (null/empty clears), `startsOn`, `endsOn`, `status`
- **classes/streams/subjects:** `name`, `code`, `status`

## Non-goals

- DELETE / soft-delete beyond `closed`
- Reparenting year/class/term FKs on PATCH
- Bulk status changes
- MoMo / PAY-PROVIDER

## Manual QA

Checklist: `tasks/manual-test-admin-academic-structure-patch-qa.md`

**Live evidence (2026-07-24):** API `:3000` + web `:3001` — create/PATCH year→active, duplicate code 409, foreign 404, term/class/stream/subject PATCH, close status, parent 403, no DELETE. Year id `064687a4-5e87-483e-b584-68db2f852c8c`. See checklist evidence table.

## Verification

```bash
npm run check
```
