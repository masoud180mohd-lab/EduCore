# ID-002 — Hosted OIDC provider (Auth0) task record

| Field     | Value |
| --------- | ----- |
| Program   | **GO IDP-002** |
| Date      | 2026-08-09 |
| Status    | **Done** (provider selected — not integrated) |
| Decision  | `docs/engineering/decisions/ID-002-hosted-oidc-provider-auth0.md` (**Accepted**: Auth0) |
| Authority | Solo-operator provisional (SOLO-GOV-001) |

## Delivered

- Chose **Auth0** as hosted OIDC for future ID-003
- EU tenant intent; local AuthN remains until integrate
- Assertion path stays disabled

## Explicitly not done

- Auth0 tenant provisioning
- OIDC code / ACF assertion enablement (`ID-003`)
- Production GO

## Next

`GO IDP-003` when Owner schedules integrate; `GO PAY-OPS` when ClickPesa keys exist.
