# ID-001 — MVP identity provider posture (local AuthN vs OIDC)

| Field       | Value                                                                    |
| ----------- | ------------------------------------------------------------------------ |
| Decision ID | `ID-001`                                                                 |
| Status      | **Accepted (solo-operator)** — 2026-08-08 (`GO IDP`)                     |
| Date        | 2026-08-08                                                               |
| Program     | B-04 residual — production IdP / OIDC                                    |
| Authority   | Solo-operator provisional (SOLO-GOV-001)                                 |
| Governing   | `16_SECURITY_STANDARDS.md` · MFA-001 · MFA-HARD · B-04 lite TM · ACF-001 |

## Objective

Close the open **“IdP not chosen”** gap with an explicit posture: either adopt an external IdP/OIDC for MVP, or **defer** and keep the current lab AuthN path under named limits.

This does **not** implement OIDC, flip production GO, or replace MFA-001.

## Current as-built (honest)

| Layer         | State                                                                 |
| ------------- | --------------------------------------------------------------------- |
| AuthN         | Local email/password → opaque session tokens                          |
| MFA           | TOTP; soft default; `MFA_ENFORCE=hard` continuous privileged gate     |
| Tenant        | `X-Tenant-Id` + session bind + RLS                                    |
| IdP assertion | Contract stub only — rejects “not enabled” (`auth.service`)           |
| Break-glass   | No product support-impersonation IdP; operator vault / DB access only |

## Options

| ID    | Posture                                                                                 | Pros                                              | Cons                                                                                              |
| ----- | --------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **A** | **Defer IdP** — keep local password + opaque sessions + MFA for **gated private pilot** | Matches as-built; lowest ops; MFA-HARD usable now | No SSO; password lifecycle on us; unsuitable for unrestricted/public multi-school without revisit |
| **B** | **Hosted OIDC now** (e.g. Auth0 / Clerk / Cognito)                                      | SSO, org policies, less password storage          | Cost, DPA/residency, integration IMP, slows staging                                               |
| **C** | **Self-host Keycloak** (or similar) on Fly                                              | Control, EU region                                | Ops burden for solo-operator; contradicts B-05 “managed” preference                               |

### Decision (Accepted)

**Option A — Defer external IdP/OIDC for MVP gated pilot.**

| Field                       | Value                                                                                         |
| --------------------------- | --------------------------------------------------------------------------------------------- |
| AuthN for gated pilot       | Local password + opaque sessions (ACF-001)                                                    |
| MFA                         | Required posture for privileged finance trust: `MFA_ENFORCE=hard` + enrolled TOTP             |
| OIDC / IdP                  | **Deferred** — no provider selected; assertion path stays disabled                            |
| Break-glass                 | Operator-only (Neon/Doppler/Fly); no end-user “login as” without a future IMP + audit         |
| Unrestricted / public pilot | **Blocked** on this residual until Option B (or revisited ADR) is Accepted **and** integrated |

## When IdP becomes mandatory (triggers)

Revisit and pick Option **B** (preferred) or **C** when any of:

1. **Unrestricted / public pilot** or multi-school SSO is required
2. A school/ministry demands federated login
3. Support needs audited impersonation / break-glass beyond DB operator access
4. Password-reset / credential-stuffing risk exceeds MFA-HARD mitigation for the pilot size

Track future work as `ID-002` (provider selection) → `ID-003` (OIDC integrate) when triggered.

## Binding rules

1. Do **not** claim “production IdP ready.”
2. Do **not** enable IdP assertion login without `ID-002`/`ID-003` Accepted.
3. Gated private pilot (few known schools) may proceed on local AuthN **only if** MFA hard + B-07 drills + overall readiness path allow — still **NO GO** until those close.
4. Secrets for passwords/MFA stay in managed DB + Doppler; never git.
5. ACF-001 dual-ready IdP contract remains documentation-only until ID-003.

## Explicit non-goals

- Implementing OIDC in this slice
- Choosing Auth0 vs Clerk vs Cognito now
- Recovery codes / WebAuthn (still MFA-006+)
- Production GO

## Acceptance (posture only)

- [x] Named Option A with limits
- [x] Triggers for mandatory IdP revisit
- [x] Break-glass honesty
- [x] Unrestricted pilot still blocked on IdP residual

## Consequences

1. Update Known Limitations / project status: IdP **explicitly deferred** (not “forgotten”).
2. B-04 residual narrows to: IdP deferred by ID-001; support/break-glass still thin.
3. Next Owner work remains **OPS-001 execute** / D1; agents may take PAY-OPS only with keys.

## Honesty

Accepted under SOLO-GOV-001. Deferral is intentional under-claiming for solo ops — not a claim that local passwords are sufficient for unrestricted production.
