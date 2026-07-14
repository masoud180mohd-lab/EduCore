# DBF-001: Database Freeze — Identity & Tenant Slice

## Outcome

Produce a reviewable **Database Freeze v1.0** design package for the first production vertical slice: **Identity And Access** + **Tenant And Billing (baseline)** + shared **audit_events**, without implementing migrations, ORM entities, or NestJS persistence.

## Status

**Design complete — proposed for formal acceptance.**  
No production schema code was written. Full platform Database Freeze for all bounded contexts remains future work.

## Acceptance criteria

| Criterion                                               | Status |
| ------------------------------------------------------- | ------ |
| ERD + table list for Identity & Tenant                  | Met    |
| Ownership of every table defined                        | Met    |
| RLS strategy for tenant isolation documented            | Met    |
| Naming conventions and data types defined               | Met    |
| Migration & rollback approach documented                | Met    |
| Task record written                                     | Met    |
| No other-module schema/code added                       | Met    |
| Freeze gates respected (no silent full-platform freeze) | Met    |

## Non-goals verified

- No Student/Academic/Attendance/Finance/Payments schemas
- No Prisma/TypeORM/SQL migration files
- No NestJS database connection wiring
- No API or frontend contracts
- No edits to immutable `EduCore/` kit documents

## Deliverable location

Primary freeze document:

- `docs/engineering/database-freeze/DBF-001-identity-tenant-slice.md`

## Scope summary

**Included tables:**  
`tenants`, `organizations`, `tenant_settings`, `plans`, `subscriptions`, `entitlements`, `users`, `tenant_memberships`, `sessions`, `mfa_factors`, `permissions`, `roles`, `role_permissions`, `user_roles`, `relationships`, `delegations`, `audit_events`.

**Owners:**

- Tenant And Billing → tenancy tables
- Identity And Access → IAM tables
- Platform Operations → `audit_events` (write via audit interface)

## Security highlights

- Tenant-owned tables require `tenant_id` + RLS using `app.current_tenant`
- Transaction-scoped tenant context; fail closed
- Platform operator bypass explicit + audited
- Credential-like fields never logged
- Isolation test matrix T1–T8 defined

## Verification

Documentation-only task. Quality gate for code remains green without schema artifacts:

```bash
npm run check
```

Formal acceptance requires Architect/Security/Backend Lead signatures in the freeze document approval block.

## Residual risks

- IdP product still open (design supports OIDC subject + optional password)
- Relationship `object_type` polymorphic links to future student IDs without FK until Student Registry freeze
- Full multi-context Database Freeze still required before broad MVP domain implementation

## Recommended next step

1. Human review and signature of DBF-001
2. **ACF-001: API Contract Freeze — Identity & Tenant slice**
3. Optionally parallel Design System Freeze for admin/identity UI shell
4. Only then: migration implementation task for Identity & Tenant tables
