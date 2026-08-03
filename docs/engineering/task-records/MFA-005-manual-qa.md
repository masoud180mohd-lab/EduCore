# Manual QA — Privileged MFA (TOTP)

Audience: owner/admin with privileged perms. Requires `MFA_TOTP_ENCRYPTION_KEY` (32-byte base64 or 64-hex) and migrations through `20260803140000`.

## Soft enforce (default)

1. Login without TOTP → session issued; `GET /auth/me` → `mfaEnrollmentRequired=true` (if finance/tenant/role.manage), `mfaEnforced=soft`, `mfaActive=false`.
2. `POST /api/v1/me/mfa-factors` + Idempotency-Key, body `{ "factorType": "totp" }` → secret + otpauthUri once.
3. Confirm with authenticator code: `POST .../mfa-factors/{id}/confirm` `{ "code": "123456" }`.
4. Logout; login again → `requiresMfa=true`, `mfaChallengeToken` set, **no** accessToken.
5. `POST /api/v1/auth/mfa/verify` `{ "mfaChallengeToken", "code" }` → access + refresh cookies/tokens.
6. `/auth/me` → `mfaActive=true`, `mfaEnrollmentRequired=false`.

## Hard enforce

1. Set `MFA_ENFORCE=hard`, restart; privileged user **without** TOTP → login `MFA_REQUIRED` (403).
2. Enroll while soft, then switch hard — login requires challenge as above.

## Honesty

1. Never log raw TOTP secrets.
2. `npm run check` green; list factors never returns `secret_encrypted`.
