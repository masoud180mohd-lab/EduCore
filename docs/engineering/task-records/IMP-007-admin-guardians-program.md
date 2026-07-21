# IMP-007 — Admin shell + Guardians

| Field     | Value                     |
| --------- | ------------------------- |
| Program   | IMP-007                   |
| Date      | 2026-07-21                |
| Authority | Solo-operator provisional |

## Discovery (A0)

| Dependency                            | Status                                  |
| ------------------------------------- | --------------------------------------- |
| Auth login / me / select-tenant       | Green (IMP-001)                         |
| Users / memberships / orgs / settings | Green (IMP-001)                         |
| Students list/get                     | Green (IMP-002)                         |
| Teacher web app                       | Green (IMP-006)                         |
| Guardians HTTP                        | Delivered in this program (DBF/ACF-010) |

## Waves

| Wave | Work                                              | Status |
| ---- | ------------------------------------------------- | ------ |
| A0   | DSF-002 provisional                               | Done   |
| A1   | Admin shell + home + users/orgs/students/settings | Done   |
| G0   | DBF-010 + ACF-010 guardians                       | Done   |
| G1   | Migrations + Nest guardians module + unit tests   | Done   |
| G2   | Admin guardians UI + tooling + check              | Done   |

## Routes (web)

- `/t/[tenantId]/admin`
- `/t/[tenantId]/admin/users`
- `/t/[tenantId]/admin/organizations`
- `/t/[tenantId]/admin/students`
- `/t/[tenantId]/admin/settings`
- `/t/[tenantId]/admin/guardians`
- `/t/[tenantId]/admin/guardians/[guardianId]`

## API (guardians)

| Method | Path                                        | Permission      |
| ------ | ------------------------------------------- | --------------- |
| GET    | `/api/v1/guardians`                         | guardian.read   |
| POST   | `/api/v1/guardians`                         | guardian.manage |
| GET    | `/api/v1/guardians/{id}`                    | guardian.read   |
| PATCH  | `/api/v1/guardians/{id}`                    | guardian.manage |
| GET    | `/api/v1/guardians/{id}/links`              | guardian.read   |
| POST   | `/api/v1/guardians/{id}/links`              | guardian.manage |
| POST   | `/api/v1/guardians/{id}/links/{linkId}/end` | guardian.manage |
| GET    | `/api/v1/students/{id}/guardians`           | guardian.read   |

## Run

```bash
npm run db:migrate
npm run rbac:reconcile-grants
npm run start:dev
npm run dev:web
```

Login as owner/admin → admin home; staff → teacher attendance.

## Five-axis review

| Axis        | Verdict | Notes                                               |
| ----------- | ------- | --------------------------------------------------- |
| Correctness | Pass    | Admin reads existing ACFs; guardians ids-only links |
| Security    | Pass    | Bearer + tenant; RLS + DEFINER; perms catalogue     |
| A11y / UX   | Pass    | Labels on forms; shared banners                     |
| Tests       | Pass    | Unit + tooling; `npm run check`                     |
| Docs        | Pass    | Provisional DSF/DBF/ACF honesty                     |

## Residual

- No roles admin UI (no `/roles` HTTP yet)
- No parent portal auth
- Playwright e2e not run
- Existing tenants need migrate + `rbac:reconcile-grants` for guardian perms

## Residual fixed (follow-up)

- OpenAPI YAML for ACF-010 (shared file with ACF-011)

## Next

Fees/finance foundation, parent portal, or ASSURE live FE e2e.
