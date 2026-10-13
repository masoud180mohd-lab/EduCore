# ID-002 — Hosted OIDC provider selection (Auth0)

| Field       | Value                                                                |
| ----------- | -------------------------------------------------------------------- |
| Decision ID | `ID-002`                                                             |
| Status      | **Accepted (solo-operator)** — 2026-08-09 (`GO IDP-002`)             |
| Date        | 2026-08-09                                                           |
| Program     | Follow-on to **ID-001** (provider selection before integrate)        |
| Authority   | Solo-operator provisional (SOLO-GOV-001)                             |
| Governing   | ID-001 · B-04 lite TM · ACF-001 IdP assertion stub · B-05 EU posture |

## Objective

Choose the **hosted OIDC IdP** for EduCore when federated login is implemented (`ID-003`). This slice **selects the vendor only** — it does **not** wire OIDC, disable local password AuthN, or flip production GO.

**Trigger note:** ID-001 listed mandatory triggers for IdP; Owner explicitly scheduled `GO IDP-002` ahead of those triggers to de-risk provider choice while staging is live.

## Options compared

| ID    | Provider                           | Pros                                                                                      | Cons                                                                |
| ----- | ---------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **A** | **Auth0** (Okta Customer Identity) | Standard OIDC; mature docs; EU private cloud / data residency options; org/SSO path later | Cost scales with MAU; another vendor DPA                            |
| **B** | **Clerk**                          | Fast app UX                                                                               | Opinionated sessions may fight our opaque-token + tenant-bind model |
| **C** | **Amazon Cognito**                 | Cheap; AWS                                                                                | Heavier UX; EU region care; less school-SSO polish                  |
| **D** | **WorkOS**                         | Strong B2B SSO / directory sync                                                           | Overkill before multi-school SSO demand                             |
| **E** | Defer selection again              | Zero cost                                                                                 | Leaves ID-002 open; surprises at ID-003                             |

### Decision (Accepted)

**Option A — Auth0** as the hosted OIDC provider for `ID-003`.

| Field                | Value                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| IdP                  | **Auth0**                                                                                                          |
| Protocol             | OIDC Authorization Code + PKCE (web); machine tokens out of MVP                                                    |
| Tenant region intent | Prefer **EU** Auth0 tenant aligned with B-05 Frankfurt / Neon EU                                                   |
| Local AuthN          | **Remains default** until ID-003 ships and a cutover flag is Accepted                                              |
| MFA                  | Keep EduCore TOTP / MFA-HARD for privileged app actions unless Auth0 MFA is explicitly adopted in a later decision |
| Assertion path       | Stays **disabled** in API until ID-003                                                                             |
| Secrets              | `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET` (names only in git) via Doppler — never commit values     |

## Binding rules

1. Do **not** claim “IdP integrated” or “SSO ready.”
2. Do **not** enable `IdP assertion` login in Nest without **ID-003** Accepted + IMP.
3. ID-001 gated-pilot local AuthN rules still apply until cutover.
4. Prefer Auth0 EU tenant; document if billing forces US tenant (residency residual).
5. Break-glass / support impersonation remains out of scope (separate IMP).

## ID-003 preview (not started)

| Step                                   | Output                                       |
| -------------------------------------- | -------------------------------------------- |
| Auth0 tenant + app (SPA / regular web) | Client IDs in Doppler                        |
| Map Auth0 `sub` → EduCore `users`      | Provisioning rules                           |
| Complete ACF-001 assertion login       | Issue opaque EduCore session after IdP proof |
| Feature flag                           | `AUTH_IDP_PROVIDER=auth0` \| `local`         |

## Explicit non-goals

- Implementing OIDC in this decision
- Migrating existing staging users to Auth0
- Replacing MFA-001 TOTP
- Production GO

## Acceptance

- [x] Named hosted provider (Auth0)
- [x] EU region intent
- [x] Local AuthN remains until ID-003
- [x] Assertion path stays off

## Consequences

1. Update Known Limitations / readiness: IdP **vendor chosen**; integration open.
2. Next: `GO IDP-003` when Owner wants implementation (or when an ID-001 trigger fires).
3. PAY-OPS still blocked on ClickPesa keys (unchanged).

## Honesty

Accepted under SOLO-GOV-001. Vendor choice ≠ security assessment or DPA signed.
