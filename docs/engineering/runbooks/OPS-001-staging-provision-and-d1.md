# OPS-001 — Staging provision + B-07 D1 restore drill (operator runbook)

| Field       | Value                                                                 |
| ----------- | --------------------------------------------------------------------- |
| Runbook ID  | `OPS-001`                                                             |
| Status      | **Published (not executed)** — 2026-08-08                             |
| Depends     | B-05 topology · B-07 schedule · B-04 lite TM                          |
| Authority   | Solo-operator provisional (SOLO-GOV-001)                              |
| Governing   | `12_DEPLOYMENT_GUIDELINES.md` · `B-05-mvp-hosting-dr-secrets.md`      |

## Purpose

Unblock **GO DRILL-D1** by listing the **operator steps** to stand up **staging** on the Accepted B-05 topology (Fly.io + Neon + Doppler, Frankfurt) and run the first Neon PITR / restore smoke.

This runbook does **not** create cloud accounts, store secrets in git, or flip production GO.

## Preconditions

- [ ] Phase 0 tooling installed — `docs/engineering/runbooks/OPS-001-phase0-tooling.md` (`npm run ops:prereq` green)
- [ ] Owner can create billing accounts on Fly / Neon / Doppler (or org already exists)
- [ ] Repo `main` builds locally: `npm run check` (or CI green on latest `main`)
- [ ] No production secrets in chat, tickets, or git
- [ ] Recovery owner = Project Owner / solo-operator (B-05)

## Phase A — Accounts (out of git)

1. Create **Doppler** project `educore` with configs: `local` (optional), `ci`, `staging` (required first), `prod` (later).  
2. Create **Neon** project `educore-staging` in **eu-central** / Frankfurt-equivalent; enable **PITR**.  
3. Create **Fly.io** org/apps in **`fra`**: start with `educore-api-staging` (web app later).  
4. Record account emails / org IDs in the operator’s private vault only — **never** this repo.

## Phase B — Secrets (names only here)

In Doppler `staging`, set (values from Neon / generated locally):

| Name | Notes |
| --- | --- |
| `NODE_ENV` | `production` or `staging` as agreed |
| `DATABASE_URL` | Neon **migrator** / privileged URL (migrate only; not Nest pool) |
| `EDUCORE_APP_DATABASE_URL` | Neon **`educore_app`** role URL |
| `EDUCORE_ENABLE_APP_DB` | `1` |
| `MFA_ENFORCE` | Prefer `soft` until privileged users enrolled; `hard` before finance pilot trust |
| `MFA_TOTP_ENCRYPTION_KEY` | 32-byte key (base64 or 64-char hex); generate once; backup in vault |
| `PAYMENT_PROVIDER` | `fake` until PAY-OPS |
| `SMS_PROVIDER` | `fake` until Beem prod |
| `AI_PROVIDER` | `fake` (or `disabled`) until product allowlist |

Optional later: `CLICKPESA_*`, `BEEM_*`, `OPENAI_API_KEY` — only when vendor paths are intentional.

## Phase C — Database bootstrap

1. From a secure operator machine with Doppler CLI (or exported env **not** written to disk long-term):  
   - Apply migrations: `npm run db:migrate` against staging `DATABASE_URL`.  
   - Confirm app role exists / grants match local `apps/api/db` docs.  
2. Seed **only** if needed for smoke: `npm run seed:admin` with staging-only passwords from Doppler — never default lab passwords in staging.  
3. Verify Neon console: PITR / backup status **green**.

## Phase D — Fly API staging

In-repo artifacts (GO FLY-DOCKER): `apps/api/Dockerfile`, `infra/fly/educore-api.staging.toml`, `infra/fly/README.md`.

1. Local image smoke (optional): `npm run docker:build:api`.  
2. `fly apps create educore-api-staging` (once) in `fra`.  
3. Wire Fly secrets from Doppler sync (or `fly secrets set` from Doppler export once) — Phase B names.  
4. Deploy: `fly deploy -c infra/fly/educore-api.staging.toml`.  
5. Hit health: `/health` → expect 200.  
6. Smoke: login + `/auth/me` with staging admin; confirm tenant bind.

**Honesty:** Phases A–C + Neon-only D1 can proceed before Fly if Dockerfile deploy is deferred; image/config are no longer the blocker.

## Phase E — B-07 D1 restore smoke (pass criteria)

Due: **2026-09-15** or within **30 days of staging Neon live** (B-07).

1. Note wall-clock start.  
2. Create a Neon **restore / branch** from a PITR timestamp (or snapshot) into a temporary database.  
3. Point a one-off connection (or Fly staging briefly) at the restored DB; run a spot check:  
   - `SELECT count(*)` on a tenant-scoped table (e.g. memberships / students)  
   - Confirm RLS still enforced (app role, not superuser)  
4. Confirm app health against restored branch **or** document “DB-only restore OK” if app rewire deferred.  
5. Tear down temporary branch when done (or keep labeled `drill-YYYY-MM-DD`).  
6. Note wall-clock end → compare to **RTO ≤ 8h** (B-05).  
7. Write evidence: `docs/engineering/task-records/B-07-restore-drill-YYYY-MM-DD.md` with:

```markdown
# B-07 restore drill — YYYY-MM-DD
| Field | Value |
| --- | --- |
| Env | staging Neon (+ Fly if used) |
| Start / End (UTC) | … |
| RTO measured | … |
| RPO assumed | Neon PITR window |
| Pass / Fail | |
| Owner | |
| Notes | |
```

## Explicit non-goals

- Production cutover  
- Multi-region  
- Committing Doppler/Fly/Neon IDs or secrets  
- Claiming D1 done without the evidence file  

## After D1 passes

- Start **weekly** Neon PITR status glance (B-07)  
- Schedule D2 (app redeploy) when Fly staging exists  
- Re-evaluate readiness prep scores; still **NO GO** until IdP/support residuals for unrestricted pilot  

## Related

- Decision: `docs/engineering/decisions/B-05-mvp-hosting-dr-secrets.md`  
- Schedule: `docs/engineering/decisions/B-07-pilot-slos-restore-drill-schedule.md`  
- Threat: `docs/engineering/decisions/B-04-lite-threat-model-session-mfa-rls.md`  
