# ID-001 — MVP IdP posture task record

| Field     | Value                                                                            |
| --------- | -------------------------------------------------------------------------------- |
| Program   | **GO IDP** / B-04 residual                                                       |
| Date      | 2026-08-08                                                                       |
| Status    | **Done** (posture locked — solo-operator provisional)                            |
| Decision  | `docs/engineering/decisions/ID-001-mvp-idp-posture.md` (**Accepted**: defer IdP) |
| Authority | Solo-operator provisional (SOLO-GOV-001)                                         |

## Delivered

- Option A: defer external IdP/OIDC; local password + opaque session + MFA for gated pilot only
- Triggers for mandatory revisit (public/unrestricted, SSO demand, break-glass product need)
- Binding rules: assertion path stays disabled until ID-002/003

## Explicitly not done

- Provider selection (Auth0/Clerk/…)
- OIDC implementation
- Support impersonation product flow
- Production GO

## Next

Owner: `GO OPS-EXEC` / D1. Optional later: `GO IDP-002` when a trigger fires; `GO PAY-OPS` with keys.
