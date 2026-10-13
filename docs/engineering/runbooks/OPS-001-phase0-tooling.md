# OPS-001 Phase 0 — Tooling install (Windows)

Install these **before** Phases A–E. No secrets in git.

**Required for `npm run ops:prereq`:** Docker Desktop (running) · `flyctl` · Doppler CLI  
**Optional:** `fly` alias · `neonctl` (Neon browser console is enough)

## 1. Docker Desktop

1. Install/start [Docker Desktop](https://www.docker.com/products/docker-desktop/).
2. Confirm: `docker info` shows a **Server Version** (not a pipe error).
3. Then: `npm run docker:build:api`

## 2. flyctl

```powershell
winget install Fly-io.flyctl
```

If `flyctl` is “not recognized”, refresh PATH in **this** shell (or open a new terminal / restart Cursor):

```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
flyctl version
flyctl auth login
```

(`fly` alias is optional — `flyctl` alone is enough.)

## 3. Doppler CLI

```powershell
winget install -e --id Doppler.doppler
```

Then refresh PATH (or open a new terminal):

```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
doppler --version
doppler login
```

`doppler setup` later — after the `educore` project exists in Doppler (Phase A).

## 4. Neon

Use [Neon console](https://console.neon.tech/) for project create (eu-central / Frankfurt).  
Optional CLI: [neonctl](https://neon.tech/docs/reference/neon-cli) — not required for prereq green.

## 5. Verify

```powershell
cd C:\Users\PM\school_management_system
npm run ops:prereq
```

Required lines must be **OK**. Optional lines may show **SKIP**.

## Continue

→ `docs/engineering/runbooks/OPS-001-staging-provision-and-d1.md` Phases A–E.
