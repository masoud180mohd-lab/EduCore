# M9 staging UAT — 2026-08-27

| Field | Value |
| --- | --- |
| Environment | staging |
| Web / API | `educore-web-staging.fly.dev` / `educore-api-staging.fly.dev` |
| Tester | Owner-assisted Codex run |
| Scope | M9-001 core workflows; no real money or payment provider |

## Results

| # | Result | Evidence / limitation |
| --- | --- | --- |
| A1 | Pass | Privileged admin password + enrolled TOTP reached the tenant shell. |
| A2 | Pass | Password-only login returned an MFA challenge and no access token under hard enforcement. |
| A3 | Pass | A refreshed authenticated session remained valid; no credential appeared in the URL. |
| B1 | Pass | Student registry presented a readable primary label. |
| B2 | **Fail** | Enrollment detail still presents academic-year / organization UUIDs instead of resolved names. |
| C1 | Partial | Fee-structure page loaded. A staging fixture was then created through the app's database helper. |
| C2 | Partial | An invoice draft was created and issued through the application helper; the browser UI path was not re-executed after browser control became unavailable. |
| C3 | Partial | An office cash payment for 10,000 minor units was accepted and fully allocated. No real payment provider was called. |
| C4 | Partial | A receipt was created and its number was present; UI receipt/history rendering still needs a browser rerun. |
| C5 | Blocked | No linked parent fixture is present in staging, so the parent portal's same-student view was not proven. |
| D1 | Pass | Teacher workspace loaded without access denial. |
| D2 | Blocked | Staging has no organization/class available to open an attendance session. |
| D3 | Blocked | Staging has no exam available for mark entry. |
| E1 | Pass | Fees and parent surfaces state that payments are office-only; they do not claim a live mobile-money provider. |
| E2 | Pass (observed) | Teacher attendance and marks surfaces made no offline-production claim. |
| E3 | Pass | Staging API `/health` returned HTTP 200 and `status: ok`. |

## Ledger-helper evidence

The app-role transaction used the normal tenant/user context and the production database helpers:

- active fee structure created;
- invoice draft created and issued;
- office `cash` payment posted for 10,000 minor units;
- invoice total and active payment allocation both equalled 10,000 minor units;
- receipt row and receipt number were present.

This proves the staging database / ledger path, but it **does not replace** the remaining browser UI workflow checks.

## Overall

**Fail / incomplete for the M9 gate.** Critical C and D rows still need browser-level proof, and C5/D2/D3 lack their required fixtures. B2 is an Important polish defect.

## Next actions

1. Restore browser-control access and re-run C1–C4 through the admin Fees UI using the existing UAT records.
2. Seed one linked parent for the invoiced student, then verify C5 through the parent portal.
3. Seed an organization/class and an exam subject, then prove attendance persistence and the marks submit/approval path.
4. Fix B2 so enrollment details resolve human-readable academic-year and organization names.
