# IMP-020 — Membership suspend / reactivate / remove

| Field     | Value                                                                     |
| --------- | ------------------------------------------------------------------------- |
| Program   | **IMP-020**                                                               |
| Date      | 2026-07-25                                                                |
| Authority | Solo-operator provisional                                                 |
| Contracts | ACF-001 §4.6 (implement-against-freeze; **no schema bump**); DSF-002 v1.9 |

## Goal

Operators can suspend, reactivate, and soft-remove a tenant membership from Admin user detail. Closes the Nest lifecycle gap left after invite-only IMP-016.

## Waves

| Wave | Work                                           | Status |
| ---- | ---------------------------------------------- | ------ |
| 0    | DSF-002 amend + this record                    | Done   |
| 1    | Nest DEFINER + routes + unit tests             | Done   |
| 2    | Admin user detail membership lifecycle UI      | Done   |
| 3    | Tooling + manual QA + `npm run check` + commit | Done   |

## Locked decisions

- Empty POST `…/suspend` | `…/reactivate` | `…/remove`; `user.manage`; optional Idempotency-Key; `200` Membership envelope
- Transitions: suspend `active`\|`invited` → `suspended`; reactivate `suspended` → `active` (`joined_at` if null); remove soft → `removed`
- Wrong/missing → **404**; same-state idempotent → 200; reject **self** suspend/remove
- Reactivate ≠ re-invite (invite may still map suspended/removed → `invited`)
- Leave `user_roles` on remove

## Manual QA

Checklist: `tasks/manual-test-admin-membership-lifecycle-qa.md`

## Non-goals

- Roles Admin, user re-enable, hard DELETE, dedicated memberships list, ACF OpenAPI bump
