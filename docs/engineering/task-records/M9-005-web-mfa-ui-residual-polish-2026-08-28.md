# M9-005 — WEB-MFA-UI residual polish

| Field     | Value                                                                                                   |
| --------- | ------------------------------------------------------------------------------------------------------- |
| Date      | 2026-08-28                                                                                              |
| Program   | **M9** Pilot hardening — item 5                                                                         |
| Governing | [`WEB-MFA-UI-login-enroll.md`](WEB-MFA-UI-login-enroll.md) · `DSF-KIT-001` · `16_SECURITY_STANDARDS.md` |
| Status    | **Done**                                                                                                |

## Objective

Close the remaining low-risk usability and safety gaps in the existing MFA
enrollment and login-challenge screens without changing the MFA protocol,
backend policy, or staging configuration.

## Delivered

- Hard enforcement now says enrollment is required, rather than merely
  recommended, for an account with no active authenticator.
- Disabling the only authenticator under hard enforcement now warns that the
  user must enroll another one in the current session before signing out.
- The setup URI and TOTP secret opt out of browser autofill, spellcheck, and
  automatic capitalization; the secret remains client-only and is never
  logged.
- Both enrollment and login code fields expose invalid state accessibly, while
  retaining six-digit numeric input and one-time-code autofill support.

## Security and scope boundary

This is a presentation-layer change only. It does not add QR generation,
recovery codes, WebAuthn, a new MFA factor type, any new credential storage,
or any change to authentication/authorization decisions. The API continues to
validate TOTP codes and owns all MFA-factor state transitions.

## Verification

- `npm run typecheck -w @educore/web` — pass.
- `npm test -w @educore/web -- src/lib/auth/complete-login.test.ts` — pass
  (3 tests).
- Reviewed the staged diff for credentials and token-like content; none is
  present.

## Outcome

M9-005 is complete. M9-002 owner UAT remains the only in-progress M9 item;
this result is not a school-cutover approval.
