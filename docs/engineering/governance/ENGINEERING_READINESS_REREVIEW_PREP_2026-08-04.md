# Engineering Readiness Re-Review Prep — 2026-08-04

| Field | Value |
| --- | --- |
| Document ID | `READY-REREVIEW-PREP-2026-08-04` |
| Against | `EduCore/42_ENGINEERING_READINESS_REVIEW.md` (2026-07-13 **NO GO**) |
| Mode | Solo-operator honesty (**SOLO-GOV-001**) |
| Status | **Prep only** — not a Board verdict; not production GO |
| Authority | Solo-operator provisional |

## Purpose

Prepare evidence for a future Engineering Readiness **re-review**. This document does **not** flip the kit to production GO. It records what moved since 2026-07-13, what remains open, and the recommended close-out order.

## Headline verdict (prep)

| Claim | Verdict |
| --- | --- |
| Unrestricted production / public pilot | **Still NO GO** |
| Gated lab IMP behind provisional DBF/ACF/DSF (SOLO-GOV-001) | **Allowed** (already practiced) |
| Independent multi-person freeze countersign | **Still missing** (SOLO-GOV-001 residual) |

## Original mandatory blockers — status update

| ID | Original issue | Status now | Evidence (examples) | Residual gap |
| --- | --- | --- | --- | --- |
| **B-01** | Database Freeze absent | **Closed-provisional (slice)** | `docs/engineering/database-freeze/DBF-001`…`013`, `DBF-AI-001*`; isolation tests under `tests/isolation/` | No kit-wide single ERD Freeze v1.0; SOLO-GOV-001 only |
| **B-02** | API Contract Freeze absent | **Closed-provisional (slice)** | `docs/engineering/api-contract-freeze/ACF-001`…`014`, `ACF-AI-*`; OpenAPI YAMLs under freeze trees | Not every future product route frozen |
| **B-03** | Design System Freeze absent | **Closed-provisional (kit freeze)** | `DSF-KIT-001` Accepted + slice DSF-001…006 | Independent design countersign still open; SOLO-GOV-001 |
| **B-04** | Threat model + IdP/session | **Closed-provisional (threat + IdP posture)** | Lite TM + **ID-001** (IdP deferred); opaque sessions + TOTP + MFA-HARD | OIDC not integrated; support/break-glass thin; soft MFA unsuitable for pilot finance |
| **B-05** | Production infra + DR | **Closed-provisional** | `docs/engineering/decisions/B-05-mvp-hosting-dr-secrets.md` (Fly.io + Neon + Doppler; RPO≤24h; RTO≤8h) | Live account provisioning + restore-drill **evidence** still open; SOLO-GOV-001 |
| **B-06** | Engineering foundation | **Closed-provisional** | Monorepo; `npm run check`; `.github/workflows/quality-gate.yml`; module boundaries script | CODEOWNERS / branch-protection proof weak; live DB tests env-dependent |
| **B-07** | Operational readiness | **Closed-provisional (ops stub)** | `B-07-pilot-slos-restore-drill-schedule.md` — 5 SLOs, alerts, D1 due 2026-09-15 / 30d after staging Neon | Executed drill evidence + multi-person on-call still open |

## Lab programmes since original review (honest)

| Programme | Lab state | Production honesty |
| --- | --- | --- |
| Identity / RBAC / students / academic / attendance / marks / guardians / fees / admin UI | Gated IMP under slice freezes | Slice-scoped only; not “full product complete” |
| Payments | ClickPesa chosen; Fake default; PAY-006 UI | **No** sandbox keys → PAY-OPS deferred; no real-money pilot |
| SMS / COMMS | Fake default; Beem env-gated | No production Sender ID / volume claim |
| AI | EPIC-AI-01 + AI-006; Fake default; OpenAI optional | Product features still gate-blocked (`lab.echo` only); DPA/residency open |
| MFA | Soft lab + MFA-HARD continuous gate | Enroll under soft before `MFA_ENFORCE=hard`; IdP still open |

## Suggested score deltas (prep — not Board scores)

Directional only relative to 2026-07-13 kit scores. **Not** a new official Board scoring.

| Area | 2026-07-13 | Prep estimate 2026-08-04 | Why |
| --- | ---: | ---: | --- |
| Database | 42 | ~58 | Many slice DBFs + isolation tests; still not kit-wide freeze |
| API | 45 | ~60 | Many slice ACFs + OpenAPI fragments |
| Security | 58 | ~72 | MFA soft+hard + lite threat model; IdP still open |
| Engineering | 66 | ~78 | Real repo, CI quality gate, boundaries |
| AI | 60 | ~72 | Gateway + Fake + eval harness + OpenAI adapter |
| Infrastructure | 38 | ~55 | B-05 topology Accepted; live provision still open |
| Operational | 43 | ~55 | B-07 SLOs + drill schedule; executed drills still open |
| **Production (overall)** | **44** | **~56** | Lab + decision stubs ≠ production GO |

## Re-review gate checklist (from § Re-Review Gate in 42)

| Gate item | Met? | Notes |
| --- | --- | --- |
| Sprint 0 exit evidence | **Yes (provisional)** | `docs/engineering/governance/SPRINT0_ENGINEERING_EXIT_NOTE.md` |
| DB / API / DSF accepted for Identity/Org slice | **Partial** | DBF/ACF under SOLO-GOV-001; **DSF-KIT-001** + slice DSFs |
| Threat-model + identity decision | **Partial** | Lite TM + ID-001 defer IdP; MFA yes; break-glass thin; OIDC not built |
| Production topology / DR decision | **Provisional yes** | B-05 Accepted (Fly+Neon+Doppler); live provision still open |
| CI, tenant-isolation, restore, ops evidence | **Partial** | CI + isolation yes; B-07 schedule yes; **executed** restore drills no |

## Recommended close-out order (next work)

1. ~~**B-05 decision brief**~~ — **Done** (`B-05-mvp-hosting-dr-secrets.md`): Fly.io + Neon + Doppler; RPO≤24h; RTO≤8h.
2. ~~**B-04 threat model (lite)**~~ — **Done** (`B-04-lite-threat-model-session-mfa-rls.md`).
3. ~~**B-07 pilot ops minimum**~~ — **Done (stub)** (`B-07-pilot-slos-restore-drill-schedule.md`); execute D1 when staging Neon exists.
4. ~~**B-03**~~ — **Done** posture then **DSF-KIT-001** Accepted (kit-wide freeze under SOLO-GOV-001).
5. ~~Operator runbook~~ — **Published** `OPS-001` + Phase 0 tooling.
6. ~~**FLY-DOCKER**~~ — **Done**.
7. ~~**ID-001**~~ — **Done** (defer IdP).
8. **OPS-EXEC** — **Blocked** on Owner machine (CLIs + Docker Desktop + billing accounts); see `OPS-EXEC-2026-08-08.md`.
9. Operator: install Phase 0 tools → Phases A–E → D1 evidence.
10. **Independent countersign** / **PAY-OPS** when humans/keys ready; **ID-002** when IdP trigger fires.

## Explicit non-claims

- This prep is **not** Engineering Readiness Review Board acceptance.
- Slice freezes Accepted under SOLO-GOV-001 are **not** independent peer review.
- Shipping lab Fake providers is **not** production provider readiness.
- `MFA_ENFORCE=hard` availability is **not** IdP/OIDC completion.
- **ID-001 Accepted (defer)** is **not** “IdP ready” — it locks deferral until a trigger.
- **B-05 Accepted** is **not** “staging is live” — accounts/IaC still operator work.
- **B-07 Accepted (stub)** is **not** “restore drills done” — schedule only until D1 evidence exists.
- **B-04 lite TM** is **not** IdP completion or independent pen-test.
- **B-03 posture** superseded same day by **DSF-KIT-001** — kit freeze Accepted under SOLO-GOV-001 (not independent design countersign).
- **OPS-001 published** is **not** staging live or D1 passed.
- **OPS-EXEC 2026-08-08** is **blocked** on CLIs/Docker/accounts — not a live deploy.
- **FLY-DOCKER artifacts** are **not** a live Fly deploy.
- **DSF-KIT-001** is **not** unrestricted production UI GO.

## Next agent/user GO options

| Code | Work |
| --- | --- |
| `GO OPS-PHASE0` | Owner: install flyctl/Doppler, start Docker Desktop (`OPS-001-phase0-tooling.md`) |
| `GO OPS-EXEC` | After Phase 0: accounts → Neon → `fly deploy` → D1 |
| `GO DRILL-D1` | After staging Neon: restore smoke evidence file |
| ~~`GO FLY-DOCKER`~~ | **Done** |
| ~~`GO IDP`~~ | **Done (defer)** — `ID-001` |
| ~~`GO DSF-KIT`~~ | **Done** — `DSF-KIT-001` |
| ~~`GO IDP-002`~~ | **Done** — Auth0 selected (`ID-002-hosted-oidc-provider-auth0.md`) |
| ~~`GO IDP-003`~~ | **Done** — Auth0 → opaque session behind `AUTH_IDP_PROVIDER` (`ID-003-auth0-oidc-opaque-session.md`) |
| `GO PAY-OPS` | Only if ClickPesa sandbox keys exist |

---

**Bottom line:** Staging on Fly `fra` + Neon Frankfurt; D1 Pass; ID-003 Auth0 code ready (flag default local). **Unrestricted production remains NO GO**.
