# MFA-HARD-OPS — Staging MFA_ENFORCE=hard flip script

| Field     | Value                                                                  |
| --------- | ---------------------------------------------------------------------- |
| Program   | **MFA-HARD-OPS**                                                       |
| Date      | 2026-08-09                                                             |
| Status    | **Done** — staging `MFA_ENFORCE=hard` (2026-08-11 Owner enroll + flip) |
| Depends   | MFA-HARD · WEB-MFA-UI · OPS-001 · Doppler + flyctl                     |
| Authority | Solo-operator provisional (SOLO-GOV-001)                               |

## Outcome

Provide a fail-closed Owner command to set staging `MFA_ENFORCE=hard` after privileged TOTP enrollment — **no payments**.

## Delivered

- `scripts/ops-stg-mfa-hard.mjs` — requires `CONFIRM=YES`; checks encryption key present; optional `DRY_RUN=1`
- npm: `ops:stg:mfa-hard`, `ops:stg:sync-fly-secrets`
- OPS-001 checklist updated

## Live flip status

**Executed 2026-08-11** — Owner enrolled TOTP for `admin@educore.staging`; Doppler `MFA_ENFORCE=hard`; Fly synced.

Owner smoke:

1. Sign out → sign in (password or Auth0) → enter 6-digit authenticator code.
2. Privileged login without TOTP should fail closed under hard.

```bash
npm run ops:stg:mfa-status
CONFIRM=YES DRY_RUN=1 npm run ops:stg:mfa-hard   # safe preview
```

**Rollback:** `doppler secrets set MFA_ENFORCE soft --project educore --config stg` then `npm run ops:stg:sync-fly-secrets`.

## Honesty

Script Ready ≠ hard already live. Production/public pilot still NO GO.
