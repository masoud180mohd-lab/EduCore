# IMP-014 — Academic Structure DELETE + Reparent

| Field     | Value                             |
| --------- | --------------------------------- |
| Program   | **IMP-014**                       |
| Date      | 2026-07-25                        |
| Authority | Solo-operator provisional         |
| Contracts | ACF-003…007 rev 1.4; DSF-002 v1.3 |

## Goal

Operators can **delete empty** structure entities (409 if dependents) and **reparent** terms/classes/streams via PATCH. Completes IMP-013 hard-STOP gaps (except MoMo / deploy).

## Waves

| Wave | Work                                            | Status |
| ---- | ----------------------------------------------- | ------ |
| 0    | ACF/OpenAPI/DSF/DBF + this record               | Done   |
| 1    | `app.delete_*` + extend `app.update_*` reparent | Done   |
| 2    | Nest DELETE + reparent PATCH + unit tests       | Done   |
| 3    | Admin detail delete + reparent controls         | Done   |
| 4    | Tooling + manual QA + `npm run check` + commit  | Done   |

## Locked decisions

- DELETE → 204; dependents → 409 (no cascade)
- Reparent allowlist: term `academicYearId`; class `academicYearId`/`termId`; stream `classId`
- No MoMo (PAY-PROVIDER-001); no production deploy

## Manual QA

Checklist: `tasks/manual-test-admin-academic-structure-delete-reparent-qa.md`

**Live evidence (2026-07-25):** API `:3000` — empty subject DELETE 204→404; year-with-term DELETE 409; stream/term/class reparent 200; parent 403; foreign 404; no cascade. See checklist evidence table.
