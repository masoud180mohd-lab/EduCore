# IMP-042 — Organization parent picker

| Field     | Value                                       |
| --------- | ------------------------------------------- |
| Program   | **IMP-042**                                 |
| Date      | 2026-08-12                                  |
| Status    | **Done** (solo-operator provisional)        |
| Depends   | IMP-040 org name resolve · IMP-030x pickers |
| Authority | Solo-operator provisional (SOLO-GOV-001)    |

## Outcome

Replace parent organization UUID paste on create/detail with a name select + Load more (active orgs). No new APIs.

## Delivered

| Surface              | Fix                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------- |
| Organizations create | `<select>` of active orgs + pagination; optional None                               |
| Organization detail  | Same picker; excludes self; seeds current parent via GET if missing from first page |

## Explicitly not done

- Nested org-tree UI / drag reparent
- Inactive parents in the main picker list (current parent still seeded if inactive)
- PAY-OPS

## Verify

- `npm run typecheck -w @educore/web`
- Manual: create child with parent from picker; edit parent; Load more on long org lists
