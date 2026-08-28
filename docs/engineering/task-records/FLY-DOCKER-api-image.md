# FLY-DOCKER / INFRA-002 — API Dockerfile + Fly staging config

| Field     | Value                                                             |
| --------- | ----------------------------------------------------------------- |
| Program   | **GO FLY-DOCKER** (OPS-001 Phase D unblock)                       |
| Date      | 2026-08-08                                                        |
| Status    | **Done** (artifacts in-repo — live deploy pending Owner accounts) |
| Authority | Solo-operator provisional (SOLO-GOV-001)                          |
| Depends   | B-05 · OPS-001                                                    |

## Delivered

- `apps/api/Dockerfile` — multi-stage Node 22; build via workspaces; runtime API-only deps
- Root `.dockerignore`
- `infra/fly/educore-api.staging.toml` — app `educore-api-staging`, region `fra`, check `/health`
- `infra/fly/README.md` + `npm run docker:build:api`

## Explicitly not done

- Live Fly app create / deploy
- Production `educore-api` app
- Web (`educore-web`) image
- CI auto-deploy

## Next

Owner: OPS-001 Phases A–E → `fly deploy -c infra/fly/educore-api.staging.toml` → D1.
