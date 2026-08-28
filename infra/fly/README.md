# Fly.io config (staging)

Topology decision: `docs/engineering/decisions/B-05-mvp-hosting-dr-secrets.md`  
Operator runbook: `docs/engineering/runbooks/OPS-001-staging-provision-and-d1.md`

| File                       | App                   | Region |
| -------------------------- | --------------------- | ------ |
| `educore-api.staging.toml` | `educore-api-staging` | `fra`  |
| `educore-api.toml`         | `educore-api`         | `fra`  |
| `educore-web.staging.toml` | `educore-web-staging` | `fra`  |
| `educore-web.toml`         | `educore-web`         | `fra`  |

## Deploy (API)

From repository root (Docker Desktop / buildkit required):

```bash
docker build -f apps/api/Dockerfile -t educore-api:local .
fly deploy -c infra/fly/educore-api.staging.toml
```

Health check: `GET /health` on internal port `3000`.

Secrets (names only — set via `fly secrets` or Doppler → Fly): see OPS-001 Phase B. Never commit values.

## Deploy (web)

```bash
fly deploy -c infra/fly/educore-web.staging.toml --remote-only
fly deploy -c infra/fly/educore-web.toml --remote-only
```

Health check: `GET /health` on internal port `3000`.

## Non-goals

- Custom domains / Auth0 callback update for staging web
- Live account creation in CI without Owner approval
