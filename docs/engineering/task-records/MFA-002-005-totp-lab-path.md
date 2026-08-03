# MFA-002…005 — TOTP schema, enroll, login challenge, honesty

| Field   | Value                    |
| ------- | ------------------------ |
| Program | **MFA-002…005**          |
| Date    | 2026-08-03               |
| Status  | **Done** (solo-operator) |
| Depends | MFA-001 Accepted         |

## Delivered

- Migration `20260803140000_mfa_factors_challenges` + SECURITY DEFINER helpers
- `GET/POST /api/v1/me/mfa-factors`, confirm, disable
- Login `requiresMfa` + `POST /api/v1/auth/mfa/verify`
- `/auth/me`: `mfaEnrollmentRequired`, `mfaEnforced`, `mfaActive`
- Env: `MFA_TOTP_ENCRYPTION_KEY`, `MFA_ENFORCE=soft|hard`
- Manual QA: `docs/engineering/task-records/MFA-005-manual-qa.md`
