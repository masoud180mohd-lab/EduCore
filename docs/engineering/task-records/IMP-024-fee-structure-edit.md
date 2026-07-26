# IMP-024 — Fee structure edit

| Field     | Value                                                        |
| --------- | ------------------------------------------------------------ |
| Program   | **IMP-024**                                                  |
| Date      | 2026-07-26                                                   |
| Authority | Solo-operator provisional                                    |
| Contracts | ACF-012 rev **1.4**; DSF-004 v**1.1**; DEFINER update helper |

## Goal

End-to-end amend of fee structures: Nest `PATCH`, SECURITY DEFINER `app.update_fee_structure`, Admin detail edit UI.

## Policy

- Allowlist body: `name?`, `status?`, `items?` (at least one field).
- `items` = full replace; **409** if any invoice line references current items.
- Name/status may update without replacing items (UI omits `items` when unchanged).

## Waves

| Wave | Work                                   | Status  |
| ---- | -------------------------------------- | ------- |
| 0    | ACF-012 + OpenAPI PATCH                | Done    |
| 1    | Migration DEFINER + Nest patch + tests | Done    |
| 2    | Admin detail edit UI + DSF-004         | Done    |
| 3    | Tooling + check + commit               | Done    |

## Non-goals

- Changing academic year or currency after create
- Partial item patch (id-preserving line edits)
- MoMo / provider pay
