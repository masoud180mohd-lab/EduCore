# MFA-001 — Privileged TOTP decision

| Field   | Value                                                   |
| ------- | ------------------------------------------------------- |
| Program | **MFA-001**                                             |
| Date    | 2026-08-03                                              |
| Status  | **Accepted** (solo-operator)                            |
| Doc     | `docs/engineering/decisions/MFA-001-privileged-totp.md` |

## Outcome

TOTP-only MFA for lab; soft enforce default; hard via `MFA_ENFORCE=hard`. Next: MFA-002 schema.
