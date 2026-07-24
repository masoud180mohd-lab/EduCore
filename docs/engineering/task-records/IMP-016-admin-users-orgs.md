# IMP-016 — Admin Users/Orgs + Nest writes

| Field     | Value                                                                                        |
| --------- | -------------------------------------------------------------------------------------------- |
| Program   | **IMP-016**                                                                                  |
| Date      | 2026-07-25                                                                                   |
| Authority | Solo-operator provisional                                                                    |
| Contracts | ACF-001 (implement frozen Org PATCH/deactivate + User disable; no schema bump); DSF-002 v1.5 |

## Goal

Ship Nest writes already frozen in ACF-001 (org PATCH/deactivate, user disable), then Admin UI for org create/edit/deactivate and staff invite/edit/disable.

## Waves

| Wave | Work                                 | Status |
| ---- | ------------------------------------ | ------ |
| 0    | DSF-002 amend + this record          | Done   |
| 1    | Nest Org PATCH + deactivate          | Done   |
| 2    | Nest User disable                    | Done   |
| 3    | Admin Organizations create + detail  | Done   |
| 4    | Admin Users invite + detail          | Done   |
| 5    | Tooling + manual QA + check + commit | Done   |

## Routes

- `/t/[tenantId]/admin/organizations` — list + create
- `/t/[tenantId]/admin/organizations/[organizationId]` — detail + PATCH + deactivate
- `/t/[tenantId]/admin/users` — list + invite
- `/t/[tenantId]/admin/users/[userId]` — detail + PATCH displayName + disable

## Nest (ACF-001 implement-against-freeze)

- `PATCH /api/v1/organizations/{id}` — `name`, `code`, `parentOrganizationId` (nullable)
- `POST /api/v1/organizations/{id}/deactivate` — status → `inactive`
- `POST /api/v1/users/{id}/disable` — status → `disabled` (`user.manage`; reject self-disable)

## Manual QA

Checklist: `tasks/manual-test-admin-users-orgs-qa.md`

## Non-goals

- Membership suspend / remove / reactivate
- Roles Admin
- AdminShell school-name header
- Enrollment transfer, MoMo, Settings form
- Org DELETE
