# ACF-001: API Contract Freeze — Identity & Tenant Slice

## Outcome

Produce a reviewable **API Contract Freeze v1.0** for the Identity & Tenant first vertical slice: REST resource contracts, OpenAPI baseline, error envelope, authZ matrix, pagination, and idempotency rules — without NestJS implementation, migrations, or other domain modules.

## Status

**Design complete — proposed for formal acceptance.**  
Companion design: `DBF-001` (also proposed for acceptance). Implementation remains blocked until both freezes are formally accepted (plus Design System Freeze for production UI).

## Acceptance criteria

| Criterion                                        | Status |
| ------------------------------------------------ | ------ |
| OpenAPI baseline for Identity & Tenant resources | Met    |
| Error contract defined                           | Met    |
| Auth & authorization requirements listed         | Met    |
| Idempotency + pagination standards               | Met    |
| Task record written                              | Met    |
| No controllers/services/entities/migrations      | Met    |
| Freeze gates / non-goals respected               | Met    |

## Deliverables

| Path                                                                                | Role                                    |
| ----------------------------------------------------------------------------------- | --------------------------------------- |
| `docs/engineering/api-contract-freeze/ACF-001-identity-tenant-slice.md`             | Freeze narrative + endpoint auth matrix |
| `docs/engineering/api-contract-freeze/openapi/acf-001-identity-tenant.openapi.yaml` | OpenAPI 3.1 contract                    |
| `docs/engineering/api-contract-freeze/README.md`                                    | Index                                   |

## Scope covered

- Auth/session high-level flows (login, MFA verify, refresh, logout, me, select-tenant)
- Tenants, organizations, tenant settings, entitlements, current subscription
- Users, memberships
- Permissions catalog, roles, user-role assignments
- MFA factors (self)
- Relationships & delegations (minimal foundation)

## Explicit exclusions

- Student/Academic/Attendance/Finance/Payments APIs
- NestJS controllers/services
- SQL migrations / ORM
- BFF dashboards, webhooks, GraphQL
- Frontend / Design System Freeze work

## Verification

Documentation-only task. Code quality gate remains green without implementation:

```bash
npm run check
```

Formal acceptance requires Architect / Backend / Security / API Contract Guardian signatures in the freeze approval block.

## Recommended next step

1. Human acceptance of **DBF-001** + **ACF-001**
2. **Design System Freeze** for identity/admin shell (unlocks PLAT-004 path)
3. Implementation epic: migrations (DBF) + Nest modules against OpenAPI (ACF) for Identity & Tenant only
