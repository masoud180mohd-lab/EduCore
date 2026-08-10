# MFA-HARD-OPS — Staging MFA_ENFORCE=hard flip script

| Field     | Value                                              |
| --------- | -------------------------------------------------- |
| Program   | **MFA-HARD-OPS**                                   |
| Date      | 2026-08-09                                         |
| Status    | **Script Ready**; staging remains **soft** (0 enrolled factors as of 2026-08-10) |
| Depends   | MFA-HARD · WEB-MFA-UI · OPS-001 · Doppler + flyctl |
| Authority | Solo-operator provisional (SOLO-GOV-001)           |

## Outcome

Provide a fail-closed Owner command to set staging `MFA_ENFORCE=hard` after privileged TOTP enrollment — **no payments**.

## Delivered

- `scripts/ops-stg-mfa-hard.mjs` — requires `CONFIRM=YES`; checks encryption key present; optional `DRY_RUN=1`
- npm: `ops:stg:mfa-hard`, `ops:stg:sync-fly-secrets`
- OPS-001 checklist updated

## Live flip status

**Not executed** — as of **2026-08-10** (`OPS-HARDEN`): `MFA_ENFORCE=soft`, `mfa_factors.count=0`. Flipping hard now would lock privileged staging login.

Owner sequence:

1. Enroll TOTP: Admin → Settings → Security (password or Auth0 path).
2. `npm run ops:stg:mfa-status` → factor count ≥ 1.
3. Soft-mode challenge smoke (sign out / sign in → 6-digit).
4. `CONFIRM=YES npm run ops:stg:mfa-hard`
5. `npm run ops:stg:sync-fly-secrets`
6. Smoke: privileged login without TOTP → `403 MFA_REQUIRED`.

```bash
CONFIRM=YES DRY_RUN=1 npm run ops:stg:mfa-hard   # safe preview
```

## Honesty

Script Ready ≠ hard already live. Production/public pilot still NO GO.
