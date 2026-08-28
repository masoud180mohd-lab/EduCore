# M9-004 — SLO-3 p95 latency baseline (staging) — 2026-08-28T06:52:46.815Z

| Field | Value |
| --- | --- |
| Sampled (UTC) | 2026-08-28T06:52:46.815Z |
| Env | staging (educore-api-staging.fly.dev), light load |
| Method | Client-side RTT from operator machine; 3 warmup + 25 sequential samples per endpoint; seed admin session (password + TOTP) |
| SLO-3 target | p95 ≤ 800 ms on core GETs (B-07) |
| Overall | **Fail** |

| Endpoint | HTTP | n | p50 | p95 | max | Within SLO-3 |
| --- | --- | --- | --- | --- | --- | --- |
| GET /health (control) | 200 | 25 | 321 ms | 1175 ms | 1510 ms | NO |
| GET /api/v1/auth/me | 200 | 25 | 415 ms | 669 ms | 682 ms | yes |
| GET /api/v1/tenants/current | 400 | 0 | — | — | — | n/a (sample failed) |
| GET /api/v1/students | 400 | 0 | — | — | — | n/a (sample failed) |
| GET /api/v1/academic-years | 400 | 0 | — | — | — | n/a (sample failed) |

## Honesty

- Client-side RTT includes operator network path to Frankfurt; Fly-side p95 may be lower.
- Sample is a baseline under light load, not sustained-load evidence.
- This record intentionally contains no credential, token, email, tenant ID, or learner data.
