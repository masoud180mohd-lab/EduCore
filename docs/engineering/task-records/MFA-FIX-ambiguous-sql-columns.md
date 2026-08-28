# MFA-FIX — Ambiguous OUT/column names in MFA SQL helpers

| Field     | Value                                    |
| --------- | ---------------------------------------- |
| Program   | **MFA-FIX**                              |
| Date      | 2026-08-11                               |
| Status    | **Done** (staging migrated)              |
| Depends   | MFA-002 · WEB-MFA-UI                     |
| Authority | Solo-operator provisional (SOLO-GOV-001) |

## Symptom

`POST /api/v1/me/mfa-factors` → **500** `Failed to begin MFA enrollment.`

## Root cause

PL/pgSQL `RETURNS TABLE (factor_type, status, …)` out-params collided with table column names (`42702 column reference "factor_type" is ambiguous`) inside `app.mfa_begin_totp_enrollment`.

## Fix

- Migration `20260811120000_mfa_helpers_ambiguous_columns` — `#variable_conflict use_column` + qualified updates
- Same hardening applied in original `20260803140000_mfa_factors_challenges.up.sql` for fresh installs
- Staging: `npm run db:migrate` applied 2026-08-11

## Owner next

1. Refresh Settings → **Enroll authenticator** → confirm 6-digit code
2. `npm run ops:stg:mfa-status` → expect `mfa_factors.count >= 1`
3. Then MFA-HARD flip (`CONFIRM=YES npm run ops:stg:mfa-hard` + Fly sync)
