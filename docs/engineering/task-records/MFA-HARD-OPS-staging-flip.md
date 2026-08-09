# MFA-HARD-OPS — Staging MFA_ENFORCE=hard flip script

| Field     | Value                                              |
| --------- | -------------------------------------------------- |
| Program   | **MFA-HARD-OPS**                                   |
| Date      | 2026-08-09                                         |
| Status    | **Script Ready** (live flip Owner-gated)           |
| Depends   | MFA-HARD · WEB-MFA-UI · OPS-001 · Doppler + flyctl |
| Authority | Solo-operator provisional (SOLO-GOV-001)           |

## Outcome

Provide a fail-closed Owner command to set staging `MFA_ENFORCE=hard` after privileged TOTP enrollment — **no payments**.

## Delivered

- `scripts/ops-stg-mfa-hard.mjs` — requires `CONFIRM=YES`; checks encryption key present; optional `DRY_RUN=1`
- npm: `ops:stg:mfa-hard`, `ops:stg:sync-fly-secrets`
- OPS-001 checklist updated

## Live flip status

**Not executed on this agent host** — Doppler/flyctl not installed here. Owner runs:

```bash
CONFIRM=YES npm run ops:stg:mfa-hard
npm run ops:stg:sync-fly-secrets
```

## Honesty

Script Ready ≠ hard already live. Production/public pilot still NO GO.
