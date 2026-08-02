# IMP-030x — Form picker Load more (Wave X)

| Field     | Value                                  |
| --------- | -------------------------------------- |
| Program   | **IMP-030** Wave X                     |
| Date      | 2026-07-30 (amended 2026-07-31)        |
| Depends   | IMP-030 ResourceListPagination helpers |
| Authority | Solo-operator provisional              |

## Goal

Stop silently truncating admin form/detail pickers at one page. When API returns `page.nextCursor`, show **Load more** under the `<select>` and append options.

## Migrated pickers

| Page                                  | Pickers                                  |
| ------------------------------------- | ---------------------------------------- |
| Fees invoices create                  | students, academic years, fee structures |
| Enrollments create + class filter     | students, classes, streams               |
| Streams create + class filter         | classes                                  |
| Classes create + year filter          | years, terms                             |
| Terms create + year filter            | years                                    |
| Fee structures create                 | years                                    |
| Guardian detail                       | bind users, link students                |
| User detail role assign               | roles, organizations                     |
| Enrollment transfer                   | classes, streams                         |
| Stream / term / class detail reparent | classes / years / years+terms            |

## Residuals

- Teacher/parent list pickers — out of MVP (IMP-030)
- AdminTable expansion for card registries — separate IMP-028 wave (DSF-002)

## Verify

```bash
npx vitest run tests/tooling/imp030-wave-x-pickers.test.ts
```
