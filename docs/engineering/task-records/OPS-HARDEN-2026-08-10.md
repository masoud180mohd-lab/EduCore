# OPS-HARDEN — Staging ops hardening pass (2026-08-10)

| Field     | Value                                              |
| --------- | -------------------------------------------------- |
| Program   | **OPS-HARDEN**                                     |
| Date      | 2026-08-10                                         |
| Status    | **Done** (solo-operator provisional)               |
| Depends   | OPS-001 · B-07 · MFA-HARD-OPS · INFRA-002-CUTOVER  |
| Authority | Solo-operator provisional (SOLO-GOV-001)           |

## Scope

MFA posture check, D1 restore re-check on Frankfurt Neon, secrets hygiene — **no** PAY-OPS, **no** production GO.

## MFA

| Check | Result |
| --- | --- |
| `MFA_ENFORCE` (Doppler `stg` + Fly) | **soft** |
| `MFA_TOTP_ENCRYPTION_KEY` | present |
| `mfa_factors` active/pending rows | **0** |
| `CONFIRM=YES DRY_RUN=1 ops:stg:mfa-hard` | would flip; **not executed** |

**Decision:** Do **not** set `hard` until Owner enrolls privileged TOTP (Admin → Settings → Security) and re-runs `npm run ops:stg:mfa-status` (expect factor count ≥ 1), then:

```bash
CONFIRM=YES npm run ops:stg:mfa-hard
npm run ops:stg:sync-fly-secrets
```

New helper: `scripts/ops-stg-mfa-status.mjs` / `npm run ops:stg:mfa-status`.

## D1 restore re-check

| Check | Result |
| --- | --- |
| Evidence | `B-07-restore-drill-2026-08-10.md` |
| Project | `educore-staging-fra` (`bitter-darkness-15594292`) |
| RTO | **9s** Pass (≪ 8h) |
| Mode | Ephemeral branch + `educore_app` spot-check + delete |

Drill script now prefers `educore-staging-fra` when `NEON_PROJECT_ID` unset; npm `ops:d1`.

## Secrets hygiene

| Check | Result |
| --- | --- |
| Staging API `/health` | ok |
| Fly secrets (Auth0 + MFA + app DB) | Deployed (names match Doppler) |
| `AUTH0_ALLOW_UNVERIFIED_EMAIL_LINK` | **absent** (good) |
| `PAYMENT_PROVIDER` | `fake` (PAY-OPS still deferred) |
| `AUTH0_DOMAIN` | US residual (`*.us.auth0.com`) — accepted for lab |
| `DATABASE_URL_LEGACY_USEAST2` | present (rollback only; do not point app) |
| `NEON_API_KEY` / `NEON_PROJECT_ID` | present |
| Chat-exposed credentials | Owner should rotate `SEED_ADMIN_PASS` / Auth0 user pass if chat logs were shared |

## Explicitly not done

- Live `MFA_ENFORCE=hard` flip (blocked on zero enrolled factors)
- Delete legacy Neon us-east-2 project (Owner console)
- Auth0 EU tenant (plan limit / residual accepted)
- Production GO / PAY-OPS
