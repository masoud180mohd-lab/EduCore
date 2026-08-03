# MFA-001 — Privileged MFA factor selection (TOTP)

| Field       | Value                                                                                    |
| ----------- | ---------------------------------------------------------------------------------------- |
| Decision ID | `MFA-001`                                                                                |
| Status      | **Accepted (solo-operator)** — 2026-08-03                                                |
| Date        | 2026-08-03                                                                               |
| Program     | Privileged MFA lab path (kit follow-on after EPIC-COMMS)                                 |
| Authority   | Solo-operator provisional (SOLO-GOV-001)                                                 |
| Governing   | Constitution MFA · DBF-001 `mfa_factors` · ACF-001 auth/MFA · `16_SECURITY_STANDARDS.md` |

**Note:** Roadmap `ID-001` (production IdP/OIDC) remains **deferred**. This program uses **MFA-001…** IDs.

## Objective

Choose the **v1 MFA factor** and lab enforcement posture so identity can enroll TOTP and challenge privileged logins without locking the solo-operator out of the lab.

## Assumptions

1. Local password AuthN stays; OIDC/IdP is out of scope.
2. Privileged signals: active grant of `finance.manage`, `tenant.manage`, or `role.manage`.
3. Lab default is **soft** enforce; production hard gate is env-flagged later.
4. Recovery codes / WebAuthn / SMS OTP deferred (MFA-006+).

## Options

| ID    | Factor                        | Pros                                       | Cons                                       |
| ----- | ----------------------------- | ------------------------------------------ | ------------------------------------------ |
| **A** | **TOTP** (authenticator apps) | Offline; no SMS cost; ACF/DBF already list | Needs encryption key for secrets at rest   |
| **B** | WebAuthn                      | Phishing-resistant                         | Browser/device UX + ceremony complexity    |
| **C** | SMS OTP                       | Familiar                                   | SIM swap; depends on COMMS; not for MFA v1 |

### Accepted

**Option A — TOTP.**

| Field               | Value                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Factor              | `totp` only in v1                                                                                                       |
| Soft gate (default) | Challenge **only if** user has active TOTP; privileged without factor still login; `/auth/me` → `mfaEnrollmentRequired` |
| Hard gate           | `MFA_ENFORCE=hard` → privileged without active TOTP cannot complete login                                               |
| Secret storage      | `secret_encrypted` via `MFA_TOTP_ENCRYPTION_KEY` (never git)                                                            |
| Challenge           | Opaque `mfaChallengeToken` (hashed; short TTL)                                                                          |

## Binding rules

1. No session tokens issued when `requiresMfa: true` until `POST /api/v1/auth/mfa/verify` succeeds.
2. Enrollment: `GET/POST /api/v1/me/mfa-factors` + confirm/disable (ACF-001 §4.8).
3. Raw TOTP secret + `otpauth://` URI only on begin-register response.
4. Do not claim production finance trust without readiness re-review + hard enforce.

## Follow-on

| ID      | Output                                     |
| ------- | ------------------------------------------ |
| MFA-002 | `mfa_factors` + `mfa_challenges` migration |
| MFA-003 | Enroll / confirm / disable / list HTTP     |
| MFA-004 | Login challenge + `/auth/mfa/verify`       |
| MFA-005 | `/auth/me` honesty + `MFA_ENFORCE` + QA    |

## Project Owner acceptance

- **2026-08-03:** Owner confirmed plan (“Privileged MFA TOTP”) → Accepted under SOLO-GOV-001.
