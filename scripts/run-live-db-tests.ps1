# Operator helper: start DEV-001 Postgres, migrate, bootstrap roles, run live RLS tests.
# Requires Docker Desktop running and on PATH.
# Usage (PowerShell):
#   .\scripts\run-live-db-tests.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Assert-Docker {
  $cmd = Get-Command docker -ErrorAction SilentlyContinue
  if (-not $cmd) {
    Write-Error @"
Docker is not on PATH.

1. Install Docker Desktop: https://www.docker.com/products/docker-desktop/
2. Start Docker Desktop and wait until it is running.
3. Open a NEW terminal so PATH updates.
4. Re-run: .\scripts\run-live-db-tests.ps1
"@
  }
  docker info 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Error 'Docker CLI found but engine is not ready. Start Docker Desktop and retry.'
  }
}

Write-Host '==> Checking Docker...'
Assert-Docker

Write-Host '==> docker:up (Postgres + Redis)...'
npm run docker:up
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host '==> db:migrate...'
npm run db:migrate
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host '==> db:bootstrap-roles...'
npm run db:bootstrap-roles
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host '==> live isolation tests (RUN_LIVE_DB_TESTS=1)...'
$env:RUN_LIVE_DB_TESTS = '1'
npm run test -- tests/isolation/tenant-rls.live.test.ts
$code = $LASTEXITCODE

if ($code -eq 0) {
  Write-Host '==> Live RLS isolation tests PASSED.'
} else {
  Write-Host "==> Live RLS isolation tests FAILED (exit $code)."
}

exit $code
