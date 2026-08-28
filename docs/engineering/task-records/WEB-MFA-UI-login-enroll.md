# WEB-MFA-UI — Login challenge + admin enroll UX

| Field     | Value                                                |
| --------- | ---------------------------------------------------- |
| Program   | **WEB-MFA-UI** (hardening within ACF-001 / MFA-HARD) |
| Date      | 2026-08-09                                           |
| Status    | **Done** (solo-operator provisional)                 |
| Depends   | MFA-001…005 · MFA-HARD · WEB-AUTH0 · DSF-KIT-001     |
| Authority | Solo-operator provisional (SOLO-GOV-001)             |

## Outcome

Close the MFA-HARD residual **“Web enroll/challenge UI”** so staging can flip `MFA_ENFORCE=hard` after privileged enrollment — **no payments work**.

## Delivered

1. Login + Auth0 callback: TOTP challenge via `POST /auth/mfa/verify` (no longer “MFA not supported”).
2. Admin **Settings → Security — authenticator**: list / begin / confirm / disable `/me/mfa-factors`.
3. Friendly copy for `MFA_REQUIRED` / `MFA_INVALID`.
4. OPS-001 MFA-HARD staging flip checklist.

## Governing freezes

- ACF-001 §4.8 MFA factors + `/auth/mfa/verify`
- DSF-KIT-001 shared chrome (Settings section; no new role shell)
- MFA-HARD continuous enforce (API already Done)

## Explicitly not done

- QR image library (otpauth URI + manual secret only)
- Recovery codes / WebAuthn (MFA-006+)
- Teacher-dedicated MFA settings page (admin Settings is the enroll surface)
- Automatic Doppler flip of `MFA_ENFORCE=hard` (Owner ops)

## Evidence

- Unit: `apps/web/src/lib/auth/complete-login.test.ts`
- Manual: enroll under soft → challenge on next login → optional hard flip per OPS-001
