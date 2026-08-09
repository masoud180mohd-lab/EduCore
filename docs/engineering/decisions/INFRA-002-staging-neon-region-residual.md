# INFRA-002 — Staging Neon region residual (vs B-05 Frankfurt)

| Field       | Value                                                                 |
| ----------- | --------------------------------------------------------------------- |
| Decision ID | `INFRA-002`                                                           |
| Status      | **Superseded by cutover** — 2026-08-09 (`GO INFRA-002-CUTOVER`) |
| Date        | 2026-08-09 (residual Accepted earlier same day; cutover completed) |
| Depends     | B-05 (Fly + Neon + Doppler; primary region Frankfurt)                 |
| Authority   | Solo-operator provisional (SOLO-GOV-001)                              |

## Context

B-05 Accepted primary region **Frankfurt / EU-central**. Staging Neon project `educore-staging` (`lively-wildflower-02524171`) was created and proven (migrate, seed, Fly, D1) on **`aws-us-east-2`**.

Moving live staging mid-flight (new EU project + re-migrate + secret rewrite + re-seed) is optional ops work, not a blocker for lab/staging honesty.

## Options

| ID | Posture | Pros | Cons |
| --- | --- | --- | --- |
| **A** | **Keep us-east-2 for staging now**; EU cutover later | No downtime; preserves D1 evidence | Diverges from B-05 primary region |
| **B** | Recreate Neon in Frankfurt immediately | Aligns with B-05 | Extra ops; re-seed; update Doppler/Fly |

### Decision

**Option A** — staging remains **us-east-2** until Owner schedules EU cutover.

| Field | Value |
| --- | --- |
| Staging Neon | us-east-2 (current) |
| B-05 target | Frankfurt still the **pilot/production** region intent |
| Fly app | `educore-api-staging` in `fra` (unchanged) |
| Cutover trigger | Before gated private pilot with TZ schools, or when latency/compliance demands |

## Binding rules

1. Do **not** claim “staging is Frankfurt” while Neon is us-east-2.  
2. New **production** Neon must be EU-central / Frankfurt per B-05 unless this decision is amended.  
3. Document cutover as `INFRA-002-CUTOVER` task when scheduled.

## Acceptance

- [x] Residual named  
- [x] Staging evidence (D1/Fly) remains valid on current region  
- [x] Production region intent unchanged (Frankfurt)

## Supersession

**2026-08-09:** Staging Neon cut over to **`educore-staging-fra`** in **`aws-eu-central-1`** (Frankfurt). See `docs/engineering/task-records/INFRA-002-CUTOVER.md`. Legacy us-east-2 URL kept in Doppler as `DATABASE_URL_LEGACY_USEAST2` only.
