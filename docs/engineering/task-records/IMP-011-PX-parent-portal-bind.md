# IMP-011-PX — Parent portal bind + scoped fees

| Field   | Value                            |
| ------- | -------------------------------- |
| Program | **IMP-011-PX**                   |
| Date    | 2026-07-23                       |
| Freezes | DBF-011 · ACF-013 · DSF-006      |
| MoMo    | Still blocked (PAY-PROVIDER-001) |

## Delivered

1. `guardians.user_id` + `bind_guardian_user` / `unbind_guardian_user`
2. System role `parent` with `parent.guardian.read` + `parent.finance.read` only
3. Staff: `POST /guardians/{id}/bind-user` · `unbind-user`
4. Parent: `GET /me/guardian` · `/me/guardian/links` · `/me/fees/**`
5. Web: `ParentShell` + `/parent/**` fees twin; admin portal bind on guardian detail
6. Login routing: admin → staff → parent → teacher default

## Isolation

Server allowlist = active links for bound guardian. `studentId` required on invoice list. No bursar `finance.read` granted to parents.

## Verification

```bash
npm run db:migrate
npm run check
```

OpenAPI: `docs/engineering/api-contract-freeze/openapi/acf-013-parent-portal.openapi.yaml`

## Manual

1. Invite/create user with active membership (no staff role needed).
2. Admin binds user UUID on guardian detail → parent role assigned.
3. Sign in as that user → lands on `/parent` → linked students → invoices via `/me/fees`.
4. Cross-student invoice id → forbidden.
5. No Issue/Pay/Reconcile; MoMo banner present.

## Next

PAY-PROVIDER supersede for MoMo — not in this program.
