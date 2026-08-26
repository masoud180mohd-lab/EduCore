# M9 staging preflight — 2026-08-26T07:24:21.277Z

| Field | Value |
| --- | --- |
| Checked (UTC) | 2026-08-26T07:24:21.277Z |
| Scope | Health and web reachability only — not workflow UAT |
| Overall | **Pass** |

| Probe | Host | HTTP | Duration | Result |
| --- | --- | --- | --- | --- |
| API health | educore-api-staging.fly.dev | 200 | 1153 ms | reachable |
| Web entry | educore-web-staging.fly.dev | 200 | 1823 ms | reachable |

## Next required action

- Owner must still complete `docs/engineering/qa/M9-uat-core-workflows.md` and record the critical workflow results separately.
- This record intentionally contains no response body, credential, token, email, tenant ID, or learner data.
