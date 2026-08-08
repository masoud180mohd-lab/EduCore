# B-05 — MVP hosting, secrets, and DR targets (decision brief)

| Field       | Value                                                                 |
| ----------- | --------------------------------------------------------------------- |
| Decision ID | `B-05` / `INFRA-001`                                                  |
| Status      | **Accepted (solo-operator)** — 2026-08-04 (`GO B05`)                  |
| Date        | 2026-08-04                                                            |
| Program     | Engineering Readiness blocker **B-05** (`42_ENGINEERING_READINESS_REVIEW.md`) |
| Authority   | Solo-operator provisional (SOLO-GOV-001)                              |
| Governing   | `12_DEPLOYMENT_GUIDELINES.md` · Architecture Freeze · SOLO-GOV-001    |

## Objective

Close readiness blocker **B-05** by naming:

1. Primary **compute** host for staging/production-shaped deploys  
2. **Managed PostgreSQL** posture (PITR-capable)  
3. **Secrets** provider (never git)  
4. Primary **region** assumption  
5. Provisional **RPO / RTO** + **recovery owner**  

This enables planning and future IaC — it does **not** authorize unrestricted production cutover (readiness overall remains **NO GO** until B-07 + threat/IdP residuals).

## Assumptions

1. Geography: **Zanzibar / Tanzania** schools first (same as PAY-001).  
2. Team: solo-operator / small team — prefer managed services over Kubernetes.  
3. App shape: Nest API + Next web + Postgres (+ workers later); existing `docker-compose` for local.  
4. Multi-region active-active remains **out of MVP** (`46_KNOWN_LIMITATIONS.md`).  
5. Local/CI continue on Docker Compose; this decision is for **staging → pilot**.

## Options compared

| ID | Topology | Pros | Cons |
| --- | --- | --- | --- |
| **A** | **Fly.io** app + **Neon** Postgres + **Doppler** secrets | Docker-native; EU region; Neon PITR; Doppler multi-env; low ops | Need to learn Fly + Neon quirks; Redis/object storage still separate later |
| **B** | **Railway** (app + PG) + platform env secrets | Fastest all-in-one | Weaker secrets discipline; region/PITR less explicit |
| **C** | **AWS** (ECS/Fargate + RDS) + Secrets Manager | Enterprise-grade | Overkill for current team size; slow to land |
| **D** | **Hetzner VPS** + managed PG | Cheap | DIY ops, backup/restore ownership risk for solo |
| **E** | Defer decision | Zero cost | Leaves B-05 open; blocks any deployment honesty |

### Decision (Accepted)

**Option A — Fly.io + Neon + Doppler**, Frankfurt / EU-central primary.

| Field | Value |
| --- | --- |
| Compute | **Fly.io** (`educore-api`, later `educore-web` / workers) |
| Database | **Neon** Postgres (project per env: staging / prod); PITR enabled |
| Secrets | **Doppler** (configs: `local` / `ci` / `staging` / `prod`); GitHub Actions sync optional |
| Primary region | **Frankfurt (`fra` / `eu-central`)** — TZ→EU latency; multi-AZ deferred |
| Staging | Required; same topology, smaller Neon branch / Fly apps |
| Local / CI | Unchanged: Docker Compose + gitignored `.env` |
| Redis | **Deferred** until worker/queue slice; then Upstash or Fly Redis |
| Object storage | **Deferred** until documents product slice; then S3-compatible (e.g. R2) |
| IaC posture | Start: `Dockerfile` + Fly/Neon config-as-code; expand Terraform when ≥2 envs proven |
| Fallback | Railway if Fly+Neon blocked for operator billing/entity |

## DR targets (provisional MVP)

Aligned with `12_DEPLOYMENT_GUIDELINES.md`:

| Metric | MVP commit | Improve-toward |
| --- | --- | --- |
| **RPO** | **≤ 24 hours** (Neon PITR + daily verify) | ≤ 1 hour |
| **RTO** | **≤ 8 hours** | ≤ 2 hours |
| Restore drill | Schedule within **B-07** (first drill date TBD; not claimed done here) | Quarterly |

| Role | Owner |
| --- | --- |
| **Recovery owner** | Project Owner / solo-operator (acting) until named SRE exists |
| Backup verification | Recovery owner — weekly check Neon backup/PITR status in staging |

## Env / secrets allowlist (names only — never values in git)

Platform / Doppler keys (non-exhaustive; product keys stay in Doppler):

- `DATABASE_URL` / `EDUCORE_APP_DATABASE_URL`  
- Session / MFA: `MFA_TOTP_ENCRYPTION_KEY`, `MFA_ENFORCE`  
- Payments / SMS / AI: `PAYMENT_PROVIDER`, `CLICKPESA_*`, `SMS_PROVIDER`, `BEEM_*`, `AI_PROVIDER`, `OPENAI_API_KEY`  
- App: `NODE_ENV`, public web URLs, webhook base URLs  

## Explicit non-goals

- Implementing Fly/Neon/Doppler accounts in this slice (operator onboarding)  
- Claiming production GO or public pilot  
- Multi-region failover design  
- Kubernetes  
- Replacing local Docker Compose  

## Consequences

1. Update `46_KNOWN_LIMITATIONS.md` / `43_PROJECT_STATUS.md`: infra **chosen provisionally**.  
2. Mark B-05 **Closed-provisional** in readiness prep.  
3. Next readiness work: **B-04 lite threat model**, then **B-07** SLO + restore-drill schedule on this topology.  
4. No secrets or account IDs committed to git.

## Acceptance (decision only)

- [x] Named compute + DB + secrets + region  
- [x] Named RPO/RTO + recovery owner  
- [x] Fake/local path unchanged  
- [x] Production cutover still blocked by overall readiness NO GO  

---

**Honesty:** Accepted under SOLO-GOV-001. Not independent SRE peer review. Topology may be superseded by ADR if billing/entity constraints force fallback **B**.
