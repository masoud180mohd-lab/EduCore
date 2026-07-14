# Implementation Plan: Audit Remediation Phase 1

## Overview

Close the four Critical audit gaps that are Phase 1 scope: version-control hygiene (G1), freeze governance / self-approval cleanup (G2), and nested kit duplicate removal (G4). Phase 2 (G3 RLS + live isolation tests) is out of scope for this session.

## Architecture Decisions

- **Git history starts now.** Create a clean initial baseline commit after hygiene (gitignore + duplicate kit removed), then append governance commits. Pre-commit deletion of `EduCore/EduCore/` is preferred over committing 79 divergent files only to delete them.
- **Conditional freeze acceptance**, not unconditional. DBF-001/ACF-001 remain formally incomplete for unrestricted coding; a Freeze Acceptance Record documents CONDITIONAL GO with explicit blockers (RLS GUC trust, live T1–T8 tests, human signatures).
- **Canonical kit root only.** Outer `EduCore/` is sole source of truth; nested `EduCore/EduCore/` is deleted and documented as removed.
- **Drive relocation is operator action.** Workspace lives under a cloud-sync path; `.gitignore` blocks sync temp dirs. Physical move out of OneDrive/Drive is recorded as residual risk for the human.

## Task List

### Phase 1: Foundation Hygiene

- [ ] Task 1: Harden `.gitignore` for Drive sync temps and commit-hygiene
- [ ] Task 2: Delete nested `EduCore/EduCore/` and add canonical-root notice
- [ ] Task 3: Add conditional Freeze Acceptance Record for Identity & Tenant
- [ ] Task 4: Soft-clean self-approval gate language; write Phase 1 task record
- [ ] Task 5: Create initial git baseline + governance commits
- [ ] Task 6: Verify `npm run check` still passes

### Checkpoint: Phase 1 Complete

- [ ] Real commit history on `main`
- [ ] `EduCore/EduCore/` gone
- [ ] Freeze Acceptance Record present with CONDITIONS
- [ ] `npm run check` green

## Risks and Mitigations

| Risk                                | Impact   | Mitigation                                         |
| ----------------------------------- | -------- | -------------------------------------------------- |
| Physical folder still on Drive sync | High     | Ignore sync temps; residual risk in task record    |
| Human signatures still blank        | Medium   | Conditional acceptance — no claim of full freeze   |
| Phase 2 RLS still open              | Critical | Explicit next action; do not start domain features |

## Open Questions

- None blocking Phase 1. Physical Drive relocation requires the operator.
