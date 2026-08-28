# M9 staging UAT — 2026-08-27

| Field       | Value                                                         |
| ----------- | ------------------------------------------------------------- |
| Environment | staging                                                       |
| Web / API   | `educore-web-staging.fly.dev` / `educore-api-staging.fly.dev` |
| Tester      | Owner-assisted Codex run                                      |
| Scope       | M9-001 core workflows; no real money or payment provider      |

## Results

| #   | Result          | Evidence / limitation                                                                                                                                     |
| --- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Pass            | Privileged admin password + enrolled TOTP reached the tenant shell.                                                                                       |
| A2  | Pass            | Password-only login returned an MFA challenge and no access token under hard enforcement.                                                                 |
| A3  | Pass            | A refreshed authenticated session remained valid; no credential appeared in the URL.                                                                      |
| B1  | Pass            | Student registry presented a readable primary label.                                                                                                      |
| B2  | **Fail**        | Enrollment detail still presents academic-year / organization UUIDs instead of resolved names.                                                            |
| C1  | Partial         | Fee-structure page loaded. A staging fixture was then created through the app's database helper.                                                          |
| C2  | Partial         | An invoice draft was created and issued through the application helper; the browser UI path was not re-executed after browser control became unavailable. |
| C3  | Partial         | An office cash payment for 10,000 minor units was accepted and fully allocated. No real payment provider was called.                                      |
| C4  | Partial         | A receipt was created and its number was present; UI receipt/history rendering still needs a browser rerun.                                               |
| C5  | Blocked         | No linked parent fixture is present in staging, so the parent portal's same-student view was not proven.                                                  |
| D1  | Pass            | Teacher workspace loaded without access denial.                                                                                                           |
| D2  | Blocked         | Staging has no organization/class available to open an attendance session.                                                                                |
| D3  | Blocked         | Staging has no exam available for mark entry.                                                                                                             |
| E1  | Pass            | Fees and parent surfaces state that payments are office-only; they do not claim a live mobile-money provider.                                             |
| E2  | Pass (observed) | Teacher attendance and marks surfaces made no offline-production claim.                                                                                   |
| E3  | Pass            | Staging API `/health` returned HTTP 200 and `status: ok`.                                                                                                 |

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

## 2026-08-28 browser rerun (addendum)

| Field   | Value                                                                                          |
| ------- | ---------------------------------------------------------------------------------------------- |
| Tool    | `scripts/ops-stg-m9-uat-browser.mjs` (Playwright, Edge channel, headless)                       |
| Fixtures| `scripts/ops-stg-m9-uat-fixtures.mjs` — teacher role + user, organization `uat-campus`, open exam with subject, guardian-bound parent user (credentials in gitignored `.local/` only) |
| Evidence| `.local/m9-uat-browser/` — per-step screenshots + `results.json` (gitignored)                   |

Next actions 1–4 above were all closed by this rerun: (1) C1–C4 executed through the admin Fees UI in a real browser; (2) C5 proven with the seeded linked parent; (3) D2/D3 proven with seeded class/exam; (4) B2 resolved without a code change (below).

| #  | Result | Evidence / limitation                                                                                       |
| -- | ------ | ----------------------------------------------------------------------------------------------------------- |
| A1 | Pass   | MFA challenge completed in the browser; landed on `/t/<tenant>/admin`.                                       |
| B1 | Pass   | Students list rendered 2 rows with readable names.                                                           |
| B2 | Pass   | Enrollment detail body contained no raw UUIDs; year/class names resolved.                                    |
| C1 | Pass   | Fee structures page listed 4 structures with its create form.                                                |
| C2 | Pass   | Draft invoice created through the Fees UI for the guardian-linked student.                                   |
| C3 | Pass   | Invoice issued; full office cash payment recorded; receipt link present.                                     |
| C4 | Pass   | Receipt page opened with the payment.                                                                        |
| C5 | Pass   | Parent (password-only login) saw the linked student and the invoice list; office-only copy present.          |
| D1 | Pass   | Teacher login reached the teacher shell.                                                                     |
| D2 | Pass   | Attendance session opened for the enrolled class; present mark saved and persisted across reload.            |
| D3 | Pass   | Mark 75 entered on the seeded exam subject; saved and persisted across reload. Approval path N/A (no Head role enabled on staging). |
| E1 | Pass   | Mobile-money request surfaced the honest “office-only until ClickPesa exists (PAY-007)” banner.              |

### B2 resolution

The 08-27 B2 failure did not reproduce at API level (`scripts/ops-stg-m9-b2-probe.mjs`: every name-resolution GET returns 200 with names) nor at browser level on the currently deployed web image. The IMP-040 resolution code (commit `e299f70`) is included in deployed `educore-web-staging` v7; the original observation predated that deploy. **No code change required.**

## Overall (superseded 2026-08-28)

**Pass for the M9 gate.** All Critical rows (A, C, D, E) pass with browser-level evidence on staging; B2 resolved as above. M9-002 may be closed; gated school cutover proceeds per `docs/engineering/runbooks/M9-pilot-cutover-checklist.md`.
