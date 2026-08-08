# B-07 — Pilot ops minimum: SLOs, owners, restore-drill schedule

| Field       | Value                                                                 |
| ----------- | --------------------------------------------------------------------- |
| Decision ID | `B-07` / `OPS-001`                                                    |
| Status      | **Accepted (stub schedule, solo-operator)** — 2026-08-08 (`GO B07`)   |
| Date        | 2026-08-08                                                            |
| Program     | Engineering Readiness blocker **B-07** (`42_ENGINEERING_READINESS_REVIEW.md`) |
| Authority   | Solo-operator provisional (SOLO-GOV-001)                              |
| Governing   | `22_OBSERVABILITY_BIBLE.md` · `12_DEPLOYMENT_GUIDELINES.md` · **B-05** |
| Depends     | `B-05-mvp-hosting-dr-secrets.md` (Fly.io + Neon + Doppler)            |

## Objective

Close readiness **B-07** at **ops-minimum / decision stub** level:

1. Name **3–5 pilot SLOs** (business + technical)  
2. Name **alert / on-call owner** (solo-operator honest)  
3. Publish a **restore-drill schedule** on the B-05 topology  

This does **not** claim drills already executed, staging live, or production GO.

## Assumptions

1. Topology = B-05: Fly.io compute, Neon Postgres (PITR), Doppler secrets, Frankfurt.  
2. Team = solo-operator until named SRE exists.  
3. Pilot = gated private schools only — not public unrestricted.  
4. Observability stack may start with Fly/Neon dashboards + structured API logs; full tracing later.  
5. Local/CI remain Docker Compose (out of drill scope except as dry-run practice).

## Pilot SLOs (MVP commit)

Aligned with `22_OBSERVABILITY_BIBLE.md`, scoped to what a solo pilot can measure:

| ID | SLO | Target (pilot) | Signal / how measured |
| --- | --- | --- | --- |
| **SLO-1** | Login success rate (auth path) | ≥ **99%** successful completions over 7d (exclude client 4xx misuse) | API logs: `POST /auth/login` + MFA verify outcomes |
| **SLO-2** | API availability (Nest health) | ≥ **99%** monthly uptime for `/health` (excl. planned maint.) | Fly health checks + uptime log |
| **SLO-3** | API p95 latency (authenticated reads) | **p95 ≤ 800 ms** for core GETs under light pilot load | Fly metrics / request logs |
| **SLO-4** | Error rate (5xx) | **&lt; 1%** of requests / day | Fly + API error envelope counts |
| **SLO-5** | Backup / PITR verifiability | Neon PITR status **checked weekly**; restore drill per schedule below | Neon console + drill runbook |

Deferred until product path is live (track, don’t pretend): payment confirmation delay, SMS delivery, AI cost — still Fake-default in lab.

## Alert thresholds (minimum)

| Alert | Condition | Severity | Owner action |
| --- | --- | --- | --- |
| API down | Health fail **> 5 min** | P1 | Page owner; check Fly + Neon |
| Error spike | 5xx **> 5%** for **15 min** | P1 | Rollback / feature flag / Fake provider |
| Login failure spike | Auth failures **> 20%** for **15 min** | P2 | Check MFA store, IdP residual N/A, credential spray |
| Backup risk | Neon PITR / backup status unhealthy | P1 | Pause writes if needed; open vendor ticket |
| Secret risk | Suspected Doppler/prod leak | P1 | Rotate keys; revoke sessions |

## On-call / owners

| Role | Owner |
| --- | --- |
| **Primary on-call** | Project Owner / solo-operator (acting) |
| **Recovery owner** | Same as B-05 (Project Owner / solo-operator) |
| **Escalation** | None named yet — residual until second human exists |
| **Alert channel** | Owner’s private channel (email/SMS/push) — not a public pager duty claim |

Honesty: single-person on-call is a **known residual** for public pilot.

## Restore-drill schedule (B-05 topology)

| Drill | Cadence | First due | Environment | Pass criteria |
| --- | --- | --- | --- | --- |
| **D1** Neon PITR / branch restore smoke | **Quarterly** (min) | **2026-09-15** (or within 30d of staging Neon live, whichever earlier) | Staging Neon | Restore to new branch; app connects; spot-check tenant row count |
| **D2** App redeploy from image | With D1 or after Fly staging exists | Same window as D1 | Fly staging | Redeploy prior image; health green |
| **D3** Secrets rotate rehearsal | Semi-annual | **2026-12-15** | Staging Doppler | Rotate one non-prod key; app picks up; old key revoked |
| **Weekly** Neon backup/PITR status glance | Weekly | Start when staging Neon exists | Staging (prod when live) | Console green; note in ops log |

### Drill evidence (when run)

Record under `docs/engineering/task-records/` as `B-07-restore-drill-YYYY-MM-DD.md` with: env, start/end time, RTO measured, RPO assumed, pass/fail, owner.

**Not claimed done in this decision** — schedule only.

## RPO / RTO binding

Inherited from B-05 (unchanged):

| Metric | MVP |
| --- | --- |
| RPO | ≤ 24h |
| RTO | ≤ 8h |

Drill D1 should measure actual restore wall-clock toward RTO.

## Explicit non-goals

- Claiming restore drills completed  
- Full observability stack (traces, synthetic farms)  
- Multi-person on-call rota  
- Production GO / public pilot authorization  
- Live Fly/Neon/Doppler provisioning (operator work)

## Acceptance (ops stub)

- [x] 5 pilot SLOs named with targets  
- [x] Alert thresholds + owner named  
- [x] Restore-drill schedule dated on B-05 topology  
- [x] Evidence template path named; no false “drilled” claim  
- [x] Production remains **NO GO** until drills run + IdP/support residuals for unrestricted pilot  

## Consequences

1. Mark B-07 **Closed-provisional (ops stub)** — evidence of executed drills still open.  
2. Update readiness prep scores honesty: ops decision exists; drills do not.  
3. Next operator work: provision staging on B-05, then execute D1 by due date.  
4. Residual close-outs: B-03 DSF posture, independent countersign, PAY-OPS when keys.

## Honesty

Accepted under SOLO-GOV-001. A schedule without executed drills is **not** operational readiness for unrestricted production.
