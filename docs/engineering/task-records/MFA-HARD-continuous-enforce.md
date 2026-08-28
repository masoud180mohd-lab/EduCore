# MFA-HARD — Continuous hard enforce for privileged access

| Field     | Value                                    |
| --------- | ---------------------------------------- |
| Program   | **MFA-HARD** (follow-on to MFA-001…005)  |
| Date      | 2026-08-04                               |
| Status    | **Done** (solo-operator provisional)     |
| Depends   | MFA-001…005 · `MFA_ENFORCE`              |
| Authority | Solo-operator provisional (SOLO-GOV-001) |

## Delivered

1. **Login fail-closed:** `MFA_ENFORCE=hard` + MFA store unavailable → `403 MFA_REQUIRED` (no silent soft login).
2. **Login enrollment gate (existing):** hard + privileged + no TOTP → `403 MFA_REQUIRED`.
3. **Continuous route gate:** `HardPrivilegedMfaGate` on `RequirePermission` for `finance.manage` / `tenant.manage` / `role.manage` when hard — requires active TOTP; store down fails closed.
4. Soft default unchanged (`MFA_ENFORCE=soft` or unset).

## Operator

```bash
# Lab default
MFA_ENFORCE=soft
MFA_TOTP_ENCRYPTION_KEY=...

# Before privileged production trust
MFA_ENFORCE=hard
```

Bootstrap: enroll TOTP under **soft**, then flip to **hard**.

## Explicitly not done

- Session `mfa_verified_at` column / revoke-all on hard flip
- ~~Web enroll/challenge UI~~ → **WEB-MFA-UI** (2026-08-09)
- Recovery codes / WebAuthn (MFA-006+)
- IdP/OIDC (see ID-001…003 / WEB-AUTH0)
