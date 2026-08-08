# B-04 / SEC-TM-001 — Lite threat model task record

| Field     | Value |
| --------- | ----- |
| Program   | **B-04** readiness blocker (threat artifact) |
| Date      | 2026-08-08 |
| Status    | **Done** (lite, solo-operator provisional) |
| Decision  | `docs/engineering/decisions/B-04-lite-threat-model-session-mfa-rls.md` (**Accepted**) |
| Authority | Solo-operator provisional (SOLO-GOV-001) |

## Delivered

- Lite threat model: assets, trust boundaries, T1–T6 attacker paths (session, MFA, RLS, RBAC, support, webhooks/AI)
- Mitigations mapped to MFA-001 / MFA-HARD / session bind / RLS isolation tests
- Residuals named: IdP/OIDC, recovery codes, soft-MFA unsuitable for pilot finance, thin break-glass

## Explicitly not done

- Full product-wide STRIDE workbook
- IdP / OIDC (`ID-001`)
- Named multi-person support rota
- Production GO

## Next

`GO B07` (pilot SLOs + restore-drill schedule).
