# ASSURE-001-O — OpenAPI for Students + Academic (ACF-002…007)

| Field     | Value                     |
| --------- | ------------------------- |
| Program   | ASSURE-001                |
| Wave      | O (OpenAPI)               |
| Date      | 2026-07-21                |
| Authority | Solo-operator provisional |

## Outcome

Close AUDIT-R5 / ASSURE-001 **contract honesty** gap: publish machine-readable OpenAPI for shipped Students + Academic Structure HTTP (no new features).

## Choice (D1)

**Option A** — single file `openapi/acf-002-007-students-academic.openapi.yaml` (reviewable; mirrors ACF-008/009 combined file).

## Deliverables

| Area    | Path                                                                                      |
| ------- | ----------------------------------------------------------------------------------------- |
| OpenAPI | `docs/engineering/api-contract-freeze/openapi/acf-002-007-students-academic.openapi.yaml` |
| Tooling | `tests/tooling/assure001-openapi-students-academic.test.ts`                               |
| Index   | `docs/engineering/api-contract-freeze/README.md` rows ACF-002…007 + ACF-008/009 honesty   |
| ACF md  | OpenAPI path pointers on ACF-002…007                                                      |

## Inventory (routes in OpenAPI = controllers)

| Resource       | Methods                       | Permissions            |
| -------------- | ----------------------------- | ---------------------- |
| students       | GET list, GET id, POST, PATCH | student.read / manage  |
| academic-years | GET list, GET id, POST        | academic.read / manage |
| terms          | GET list, GET id, POST        | academic.read / manage |
| classes        | GET list, GET id, POST        | academic.read / manage |
| streams        | GET list, GET id, POST        | academic.read / manage |
| subjects       | GET list, GET id, POST        | academic.read / manage |

## Doubt checks

| Probe                                | Result                                       |
| ------------------------------------ | -------------------------------------------- |
| OpenAPI route not in controllers?    | No — DELETE absent; methods match Nest       |
| Missing list filters vs controllers? | No — status/search/yearId/termId/classId     |
| Freeze re-acceptance?                | No — solo-operator provisional pointers only |

## Verification

`npm run check`
