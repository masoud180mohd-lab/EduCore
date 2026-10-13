# Fly.io config (staging)

Topology decision: `docs/engineering/decisions/B-05-mvp-hosting-dr-secrets.md`  
Operator runbook: `docs/engineering/runbooks/OPS-001-staging-provision-and-d1.md`

| File                       | App                   | Region |
| -------------------------- | --------------------- | ------ |
| `educore-api.staging.toml` | `educore-api-staging` | `fra`  |

## Deploy (API)

From repository root (Docker Desktop / buildkit required):

```bash
docker build -f apps/api/Dockerfile -t educore-api:local .
fly deploy -c infra/fly/educore-api.staging.toml
```

Health check: `GET /health` on internal port `3000`.

Secrets (names only — set via `fly secrets` or Doppler → Fly): see OPS-001 Phase B. Never commit values.

## Non-goals

- Production `educore-api` app (create when pilot GO path opens)
- Next.js (`educore-web`) image — deferred
- Live account creation in CI without Owner approval
