# B-04 — Lite threat model: session, MFA, RLS, support access

| Field       | Value                                                                         |
| ----------- | ----------------------------------------------------------------------------- |
| Decision ID | `B-04` / `SEC-TM-001`                                                         |
| Status      | **Accepted (lite, solo-operator)** — 2026-08-08 (`GO B04-THREAT`)             |
| Date        | 2026-08-08                                                                    |
| Program     | Engineering Readiness blocker **B-04** (`42_ENGINEERING_READINESS_REVIEW.md`) |
| Authority   | Solo-operator provisional (SOLO-GOV-001)                                      |
| Governing   | `16_SECURITY_STANDARDS.md` · MFA-001 · MFA-HARD · Architecture Freeze         |

## Objective

Close the **threat-model artifact** gap for readiness B-04 (lite scope): name assets, trust boundaries, and first-slice attacker paths for **session**, **MFA**, **tenant RLS**, and **support / break-glass** access.

This does **not**:

- Complete IdP/OIDC (`ID-001` remains deferred)
- Claim production GO
- Replace a full STRIDE workbook for every product module

## Scope (in / out)

| In scope                                    | Out of scope (residual)               |
| ------------------------------------------- | ------------------------------------- |
| Lab opaque sessions + refresh               | External IdP / OIDC federation        |
| Privileged TOTP (soft + hard)               | WebAuthn, recovery codes, SMS OTP     |
| Tenant header bind + Postgres RLS           | Every future product route abuse case |
| Solo-operator support / break-glass honesty | Named multi-person break-glass rota   |
| Fake vs real payment/SMS/AI providers (env) | Vendor DPA / residency reviews        |

## Assets (what attackers want)

1. **Session tokens** — impersonate a user inside a tenant
2. **Privileged permissions** — `finance.manage` / `tenant.manage` / `role.manage`
3. **Cross-tenant student / finance data** — via RLS bypass or header spoof
4. **MFA secrets / challenge tokens** — enroll hijack or MFA skip
5. **Secrets in Doppler / env** — DB URL, `MFA_TOTP_ENCRYPTION_KEY`, provider keys
6. **Support impersonation** — silent access without audit

## Trust boundaries

```
[Browser / web] --HTTPS--> [Next web] --API--> [Nest API]
                                              |-- opaque session lookup
                                              |-- X-Tenant-Id bind
                                              |-- permission + MFA-HARD gate
                                              |-- Postgres (RLS + app.current_tenant)
[Operator] ----Doppler----> secrets (not git)
[CI] --------GH secrets---> non-prod only
[Vendors] ---webhooks-----> payments / SMS / AI (env-gated; Fake default)
```

Untrusted: any HTTP input (headers, bodies, cookies/tokens, webhook payloads, LLM output).

## Attacker paths (lite)

### T1 — Stolen or leaked session token

|                     |                                                                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Path**            | Token exfil (XSS, logs, shared device) → `Authorization` replay                                                                                     |
| **Impact**          | Act as victim until revoke/expiry; if privileged + soft MFA, may reach finance without continuous TOTP                                              |
| **Mitigations now** | Opaque hashed sessions; logout revoke; short-lived challenge tokens for MFA; httpOnly cookie posture on web where used; fail-closed token validator |
| **Residual**        | No device binding; soft MFA allows privileged login without factor; continuous MFA only under `MFA_ENFORCE=hard`                                    |

### T2 — MFA bypass / enrollment gap

|                     |                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Path**            | Privileged account without TOTP under soft; or hard flip before enroll → lockout; or challenge-token brute/reuse                                              |
| **Impact**          | Privileged actions without second factor; or operator lockout                                                                                                 |
| **Mitigations now** | MFA-001 soft default with `mfaEnrollmentRequired`; hard login + continuous `HardPrivilegedMfaGate`; challenge hashed + TTL; store-down fail-closed under hard |
| **Residual**        | Soft unsuitable for pilot finance trust; no recovery codes; no session `mfa_verified_at` revoke-all on hard flip                                              |

### T3 — Cross-tenant via header / membership spoof

|                     |                                                                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Path**            | Forge `X-Tenant-Id` or reuse session against foreign tenant                                                                                                              |
| **Impact**          | Read/write another school's data                                                                                                                                         |
| **Mitigations now** | Tenant middleware UUID validation; session↔header bind; membership check; Postgres RLS (`app.current_tenant` / `app.rls_mode`); isolation tests under `tests/isolation/` |
| **Residual**        | New tables without RLS are high risk; support paths that disable RLS must be explicit + audited                                                                          |

### T4 — Privilege escalation via RBAC / policy gaps

|                     |                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| **Path**            | Call manage routes without permission; stale grants after role change                             |
| **Impact**          | Unauthorized finance/tenant/role changes                                                          |
| **Mitigations now** | `RequirePermission` + membership-aware permission source; MFA-HARD on privileged codes under hard |
| **Residual**        | Role/grant UX thin; no full session revoke on privilege change                                    |

### T5 — Support / break-glass abuse

|                                 |                                                                                                                                  |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Path**                        | Shared “admin” credentials; DB superuser; Doppler prod secrets used for casual debug                                             |
| **Impact**                      | Undetected cross-tenant access; secret sprawl                                                                                    |
| **Mitigations now**             | **Honesty:** no product break-glass IdP; solo-operator owns Neon/Doppler/Fly; secrets never in git; Fake providers default in CI |
| **Controls required for pilot** | Named recovery owner (B-05); audited DB access only; no shared password vault in chat; prefer time-boxed staging credentials     |
| **Residual**                    | Thin support model; IdP + break-glass workflow still open                                                                        |

### T6 — Provider / webhook spoof (adjacent)

|                     |                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------ |
| **Path**            | Fake payment/SMS webhook without signature; AI prompt injection via `lab.echo`             |
| **Impact**          | False payment state; data exfil via model                                                  |
| **Mitigations now** | Fake default; real vendors env-gated; AI allowlist + metering; PAY/COMMS adapter contracts |
| **Residual**        | PAY-OPS / Beem prod need signature verify + MFA hard + readiness path                      |

## STRIDE summary (boundaries)

| Boundary      | S                      | T                     | R                            | I                        | D                   | E                      |
| ------------- | ---------------------- | --------------------- | ---------------------------- | ------------------------ | ------------------- | ---------------------- |
| Session token | AuthN opaque           | HTTPS + hashed store  | Login/logout audit (partial) | Generic auth errors      | Rate limit residual | MFA-HARD + permissions |
| Tenant header | Membership bind        | UUID validate         | —                            | RLS                      | —                   | Permission codes       |
| MFA           | Challenge gate         | Encrypted TOTP secret | Challenge consume            | No secret in logs        | Challenge TTL       | Hard continuous gate   |
| Support/DB    | Operator identity only | Doppler               | Neon audit (vendor)          | Least privilege residual | —                   | No RLS-off in app code |

## Acceptance criteria (lite artifact)

- [x] Assets + trust boundaries named
- [x] Session / MFA / RLS / support paths documented with mitigations + residuals
- [x] IdP/OIDC explicitly deferred
- [x] Production remains **NO GO** until B-07 ops minimum + IdP/support residuals addressed for public pilot

## Consequences

1. Mark B-04 **Closed-provisional (threat artifact)** — IdP still open residual.
2. Pilot finance trust requires `MFA_ENFORCE=hard` + enrolled TOTP + B-07 ops.
3. Next: **B-07** pilot SLOs + restore-drill schedule on B-05 topology.

## Honesty

Accepted under SOLO-GOV-001. Not an independent security assessment. Does not supersede Constitution or `16_SECURITY_STANDARDS.md`.
