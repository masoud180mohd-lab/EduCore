# B-07 D2 restore drill — 2026-08-13 (app redeploy)

| Field                | Value                                                                       |
| -------------------- | --------------------------------------------------------------------------- |
| Env                  | Fly staging `educore-api-staging` (fra) + Neon `educore-staging-fra`        |
| Start (UTC)          | 2026-08-13T09:30:04Z (deploy)                                               |
| End (UTC)            | 2026-08-13T09:31:46Z (deploy exit 0)                                        |
| Health (UTC)         | 2026-08-13T09:33:38.820Z                                                    |
| Image                | `registry.fly.io/educore-api-staging:deployment-01KZX7ACM5Q0EJK36QZWTE0DME` |
| Pass / Fail          | **Pass**                                                                    |
| Owner                | Project Owner / solo-operator (SOLO-GOV-001)                                |
| Pass criteria (B-07) | Redeploy from image; `/health` green                                        |

## Checks

| Check                                                               | Result                                                                                                |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `flyctl deploy -c infra/fly/educore-api.staging.toml --remote-only` | exit 0; “Visit your newly deployed app”                                                               |
| `GET https://educore-api-staging.fly.dev/health`                    | `{"status":"ok","service":"educore-api",…}`                                                           |
| Machines                                                            | `08053e9c3d6d68`, `185904db671578` reached good state (auto_stop may leave them stopped after health) |

## Honesty

- B-07 D2 is **app image redeploy + health**, not another Neon branch clone (that is D1; Pass earlier the same day).
- Fly was **not** rewired onto the ephemeral D1 PITR branch (would interrupt staging primary). App continues on Frankfurt primary.
- `/health` JSON `environment` is `production` because staging Fly sets `NODE_ENV=production` — that is **not** a Board production GO.
- Weekly PITR glance is a separate SLO-5 artifact.
