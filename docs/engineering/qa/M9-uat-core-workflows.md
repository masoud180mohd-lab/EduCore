# M9 UAT — Core gated-pilot workflows

| Field | Value |
| --- | --- |
| Program | **M9** Pilot hardening |
| Slice | **M9-001** |
| Purpose | Prove office-fees + online attendance/marks + parent fee visibility before Owner cutover |
| Env | Record URL + tenant id used |
| Auth | Privileged admin with MFA when `MFA_ENFORCE=hard` |

## Setup

| Item | Value (fill when running) |
| --- | --- |
| Date (UTC) | |
| Env | staging / prod / local |
| Web URL | |
| API base | |
| Tenant id | |
| Admin email | |
| Tester | Owner |

Pass = all critical rows Pass. Blockers = any Fail on Critical.

## A — Auth / MFA (Critical)

| # | Step | Expected | Pass/Fail |
| --- | --- | --- | --- |
| A1 | Login with password (+ MFA if enrolled) | Session; land in tenant shell | |
| A2 | Privileged admin route without MFA when hard (unenrolled or skip MFA) | Blocked / `MFA_REQUIRED` — not silent access | |
| A3 | Logout / refresh | Session ends or renews safely; no token in URL | |

## B — Admin academic smoke (Important)

| # | Step | Expected | Pass/Fail |
| --- | --- | --- | --- |
| B1 | Open students or enrollments list | Names readable; no raw UUID-only primary labels where polish shipped | |
| B2 | Open one enrollment detail | Year/org names resolve where IMP-040 applied | |

## C — Office fees path PAY-007 (Critical)

| # | Step | Expected | Pass/Fail |
| --- | --- | --- | --- |
| C1 | Fee structures list | Structures load | |
| C2 | Create or select structure + generate/open invoice | Invoice visible for student | |
| C3 | Record office payment (cash/bank/cheque) | Payment accepted; ledger consistent | |
| C4 | Receipt / payment history | Receipt or history shows payment; amount correct | |
| C5 | Parent portal fee view (same student) | Balance/fees visible; copy does **not** claim MoMo live | |

## D — Teacher online attendance / marks (Critical for school day)

| # | Step | Expected | Pass/Fail |
| --- | --- | --- | --- |
| D1 | Teacher login (or admin acting role if lab) | Teacher shell | |
| D2 | Open attendance session; mark present/absent | Saves; reload persists | |
| D3 | Enter marks for a subject/assessment | Saves; approval path if Head enabled | |

## E — Honesty checks (Critical)

| # | Step | Expected | Pass/Fail |
| --- | --- | --- | --- |
| E1 | No UI claim of Mixx/M-Pesa/ClickPesa unless PAY-OPS live | Copy matches Fake/office path | |
| E2 | No claim of offline attendance production-ready | Online-only language or lab disclaimer | |
| E3 | `/health` OK on API used by this UAT | `status: ok` | |

## Result

| Field | Value |
| --- | --- |
| Overall | Pass / Fail |
| Blockers | |
| Residuals accepted | e.g. PITR 6h, solo on-call |
| Evidence links | screenshots/logs paths (no secrets) |

File completed runs as `docs/engineering/task-records/M9-uat-<env>-YYYY-MM-DD.md` (copy this table + results).

## Out of scope this script

- ClickPesa sandbox
- Beem live SMS
- Offline sync conflict matrix
- AI product features beyond lab gate
