# IMP-012 — Admin Academic Structure UI

| Field     | Value                     |
| --------- | ------------------------- |
| Program   | **IMP-012**               |
| Date      | 2026-07-24                |
| Authority | Solo-operator provisional |
| Contracts | ACF-003…008; DSF-002 v1.1 |

## Goal

Admin UI to create the academic year tree and enroll students against existing Nest HTTP (no new structure PATCH/DELETE).

## Waves

| Wave | Work                                  | Status |
| ---- | ------------------------------------- | ------ |
| 0    | DSF-002 amend + this record           | Done   |
| 1    | Nav + hub + years                     | Done   |
| 2    | Terms + classes                       | Done   |
| 3    | Streams + subjects                    | Done   |
| 4    | Enrollments (+ status PATCH)          | Done   |
| 5    | Manual QA + tooling + `npm run check` | Done   |

## Routes

- `/t/[tenantId]/admin/academic` — hub
- `…/years`, `…/years/[id]`
- `…/terms`, `…/terms/[id]`
- `…/classes`, `…/classes/[id]`
- `…/streams`, `…/streams/[id]`
- `…/subjects`, `…/subjects/[id]`
- `…/enrollments`, `…/enrollments/[id]` (status PATCH)

## Manual QA

Checklist: `tasks/manual-test-admin-academic-qa.md`

## Non-goals

- Structure PATCH/DELETE
- MoMo / PAY-PROVIDER
- Bulk enroll / report cards

## Verification

```bash
npm run check
```

## Doubt checks

| Check                           | Answer                          |
| ------------------------------- | ------------------------------- |
| Bursar pick year from Admin UI? | Yes — same GET years            |
| Edit year name?                 | No — read-only until future ACF |
| Cross-tenant leak?              | No — existing APIs              |
