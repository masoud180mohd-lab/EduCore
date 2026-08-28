# M9-004 — SLO-3 p95 latency baseline (staging) — 2026-08-28T06:58:54.307Z

| Field         | Value                                                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Sampled (UTC) | 2026-08-28T06:58:54.307Z                                                                                                   |
| Env           | staging (educore-api-staging.fly.dev), light load                                                                          |
| Method        | Client-side RTT from operator machine; 3 warmup + 25 sequential samples per endpoint; seed admin session (password + TOTP) |
| SLO-3 target  | p95 ≤ 800 ms on core GETs (B-07)                                                                                           |
| Overall       | **Pass**                                                                                                                   |

| Endpoint                    | HTTP | n   | p50    | p95    | max    | Within SLO-3 |
| --------------------------- | ---- | --- | ------ | ------ | ------ | ------------ |
| GET /health (control)       | 200  | 25  | 295 ms | 314 ms | 323 ms | yes          |
| GET /api/v1/auth/me         | 200  | 25  | 340 ms | 355 ms | 360 ms | yes          |
| GET /api/v1/tenants/current | 200  | 25  | 333 ms | 352 ms | 386 ms | yes          |
| GET /api/v1/students        | 200  | 25  | 338 ms | 640 ms | 642 ms | yes          |
| GET /api/v1/academic-years  | 200  | 25  | 343 ms | 541 ms | 824 ms | yes          |

## Honesty

- Client-side RTT includes operator network path to Frankfurt; Fly-side p95 may be lower.
- Sample is a baseline under light load, not sustained-load evidence.
- This record intentionally contains no credential, token, email, tenant ID, or learner data.
