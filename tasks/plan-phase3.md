# Implementation Plan: Audit Remediation Phase 3

## Overview

Close High audit gaps: documentation drift, repository tokens on public barrels, and a CI baseline that runs `npm run check`.

## Tasks

- [ ] Remove `*_REPOSITORY` exports from all 14 public barrels
- [ ] Document public API without repository tokens; add static barrel test
- [ ] Reconcile stale docs (skeleton, repo map, docker README, PLAT-003, dev-env)
- [ ] Add GitHub Actions workflow for quality gate
- [ ] Document Docker prerequisite for live RLS tests (operator)

## Non-goals

- Installing Docker on the operator machine
- Business features / Nest domain routes
- Full DBF T4–T8 membership scenarios
