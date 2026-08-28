# F-002 — Production MFA_ENFORCE=hard (2026-08-13)

| Field     | Value                                       |
| --------- | ------------------------------------------- |
| Finding   | **F-002** prod privileged MFA still soft    |
| Status    | **Closed** (ops)                            |
| Authority | SOLO-GOV-001 — does **not** change Board V3 |

## Evidence (no secrets)

1. `ops-prd-mfa-status.mjs`: `active_totp=1`, `privileged_without_totp=0`.
2. `CONFIRM=YES ops-prd-mfa-enroll.mjs`: pending TOTP confirmed `active`. otpauth written to gitignored `.local/prod-admin-totp.otpauth.txt`.
3. `CONFIRM=YES ops-prd-mfa-hard.mjs`: Doppler `educore/prd` `MFA_ENFORCE=hard`.
4. `ops-prod-sync-fly-secrets.mjs`: Fly `educore-api` secrets deployed (names only).
5. `/health` `environment: production` still means NODE_ENV, not GO.

## Owner action

Scan `.local/prod-admin-totp.otpauth.txt` into authenticator **now**. Without that entry, privileged login cannot complete the challenge. Delete the file after scan.

Rollback: `doppler secrets set MFA_ENFORCE=soft --silent --project educore --config prd` then `npm run ops:prod:sync-fly-secrets`.

## Not closed by this file

F-001 (ClickPesa), F-003 (6h PITR), F-005 (independent freeze re-sign).
