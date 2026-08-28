# M9-004 — SLO-3 p95 latency baseline (staging) — 2026-08-28T06:57:04.064Z

| Field         | Value                                                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Sampled (UTC) | 2026-08-28T06:57:04.064Z                                                                                                   |
| Env           | staging (educore-api-staging.fly.dev), light load                                                                          |
| Method        | Client-side RTT from operator machine; 3 warmup + 25 sequential samples per endpoint; seed admin session (password + TOTP) |
| SLO-3 target  | p95 ≤ 800 ms on core GETs (B-07)                                                                                           |
| Overall       | **Fail**                                                                                                                   |

| Endpoint                    | HTTP | n   | p50    | p95    | max     | Within SLO-3 |
| --------------------------- | ---- | --- | ------ | ------ | ------- | ------------ |
| GET /health (control)       | 200  | 25  | 329 ms | 656 ms | 828 ms  | yes          |
| GET /api/v1/auth/me         | 200  | 25  | 404 ms | 954 ms | 1407 ms | NO           |
| GET /api/v1/tenants/current | 200  | 25  | 371 ms | 404 ms | 433 ms  | yes          |
| GET /api/v1/students        | 200  | 25  | 381 ms | 414 ms | 531 ms  | yes          |
| GET /api/v1/academic-years  | 200  | 25  | 369 ms | 394 ms | 424 ms  | yes          |

## Honesty

- Client-side RTT includes operator network path to Frankfurt; Fly-side p95 may be lower.
- Sample is a baseline under light load, not sustained-load evidence.
- This record intentionally contains no credential, token, email, tenant ID, or learner data.
