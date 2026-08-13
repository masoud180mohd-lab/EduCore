# F-004: staff vs bursar (classroom ≠ money)

## Outcome

Close Board finding **F-004**: system role `staff` included `finance.manage`, so a teacher assigned `staff` could create invoices and office-pay.

## Status

**Closed in code** (SOLO-GOV-001). Does not stamp V3 GO. Does not close F-005.

## Resolution

| Item           | Change                                                                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Matrix         | `staff` loses `finance.read` / `finance.manage`. New `bursar` holds them.                                                                |
| SQL            | Migration `20260813170000_staff_bursar_split` inserts bursar, revokes staff finance grants, allows `assign_system_role_codes('bursar')`. |
| Invite UI      | Role picker includes `bursar`.                                                                                                           |
| HTTP           | Classroom staff permission set → `POST /invoices` and `POST /payments` **403**.                                                          |
| Existing users | Staff are **not** auto-assigned bursar. Owner/admin still have finance.manage.                                                           |

## Ops after deploy

```bash
doppler run --project educore --config stg -- npm run db:migrate
doppler run --project educore --config stg -- npm run rbac:reconcile-grants -- --all-tenants
```

Assign `bursar` to fee clerks. Retrieve passwords locally; never from chat.

## Honesty

- Custom roles can still be granted `finance.manage` (no deny-list). Default seed matrix is what F-004 required.
- Staging/prod DBs are not closed until this migration is applied.
