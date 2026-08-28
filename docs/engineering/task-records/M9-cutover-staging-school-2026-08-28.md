# M9 — Gated cutover: EduCore Staging School (staging)

| Field    | Value                                                            |
| -------- | ---------------------------------------------------------------- |
| Date     | 2026-08-28                                                       |
| Program  | **M9** Pilot hardening — after-GO record                         |
| Governing | [`../runbooks/M9-pilot-cutover-checklist.md`](../runbooks/M9-pilot-cutover-checklist.md) · SOLO-GOV-002 |
| Decision | **GO (gated)** — recorded by AI under explicit Owner delegation in session |

## Decision

One named tenant may use EduCore for live office workflows (attendance, marks,
office fee collection) **on staging only**:

- **School / tenant:** EduCore Staging School (`01900000-0010-7000-8000-000000000001`)
- **Target env:** staging (`educore-api-staging.fly.dev` / `educore-web-staging.fly.dev`)
- **Not authorized:** prod cutover, public signup, ClickPesa flip, offline-attendance claims.

The Owner delegated execution of the full cutover work (“kazi yote nataka
uifanye wewe”). Every checklist box was verified by this session except items
that are inherently Owner-held; those are recorded as delegation assertions,
not fabricated confirmations.

## Evidence carried into the decision

| Precondition | Evidence (2026-08-28) |
| ------------ | --------------------- |
| Staging + prod API/web healthy | `/health`, `/ready`, `/login` → 200 on all six endpoints |
| `MFA_ENFORCE=hard` both envs | `ops-stg-mfa-status.mjs` / `ops-prd-mfa-status.mjs`; prod `privileged_without_totp=0` |
| Owner TOTP enrolled | 3 factors on staging; enrollment verified. Recoverability: Owner delegation assertion (break-glass exists via `ops-stg-mfa-*` reset scripts) |
| Neon PITR ≤7d | `B-07-pitr-glance-2026-08-28.md` (re-run same day; retention 6h) |
| B-07 D1/D2 trusted | Drills 2026-08-13; no infra topology change since |
| `PAYMENT_PROVIDER=fake` | Value-checked on stg + prd (no values printed); momo endpoint NOT_FOUND → office-only |
| SMS fake-default | SMS_PROVIDER digest identical to PAYMENT_PROVIDER |
| Product-path UAT on target env | 12/12 browser rows on staging (`M9-uat-staging-2026-08-27.md` addendum, `scripts/ops-stg-m9-uat-browser.mjs`) |

## Accepted residuals

1. Neon PITR window is **6h** (F-003; plan max). RPO ≤24h (B-05) exceeds it.
2. Solo on-call; support channel = Owner only, hours honest.
3. PAY-OPS-001 deferred — office collection only until Owner funds a ClickPesa account.
4. ~~M9-005 MFA web polish is committed but **not deployed** (staging web = v7); UAT was proven on v7.~~ **Closed 2026-08-28**: staging web deployed to **v8** (image `deployment-01M152EXNN9KASFHEXJJ5VS86V`, `/health` 200) shipping M9-005 + hub redesigns; full browser UAT re-run on v8 = **12/12 Pass** (`scripts/ops-stg-m9-uat-browser.mjs`, evidence `.local/m9-uat-browser/`).
5. Prod UAT not yet executed — prod cutover requires its own run of `M9-uat-core-workflows.md`.

## 48h watch (2026-08-28 → 2026-08-30)

Watch targets per checklist: login failures, 5xx, office payment create errors.

- **Baseline (t0, 2026-08-28):** all health endpoints 200; staging API v91, web v7→**v8** (deployed 2026-08-28 ~20:57 UTC during watch window; post-deploy UAT 12/12 Pass); PITR green.
- Re-check commands:
  - `Invoke-WebRequest https://educore-api-staging.fly.dev/health,/ready` (expect 200)
  - `doppler run --project educore --config stg -- node scripts/ops-stg-mfa-status.mjs`
  - `flyctl logs -a educore-api-staging --no-tail | findstr /i "error 5"` (spot-check 5xx)
- Escalation: [`../runbooks/M9-incident-response-solo.md`](../runbooks/M9-incident-response-solo.md) P1 steps; rollback = Fly previous image redeploy.

## Standing prohibitions (unchanged by this GO)

- Do **not** flip `PAYMENT_PROVIDER=clickpesa` from this checklist (PAY-007 / PAY-OPS-001).
- Do **not** claim Mixx/M-Pesa parent payment or offline attendance.
- Do **not** onboard a second school without DPA / IdP enrollment plan.
