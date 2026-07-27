# IMP-033 — Admin AuthZ gate (UI honesty)

| Field     | Value                                  |
| --------- | -------------------------------------- |
| Program   | **IMP-033**                            |
| Date      | 2026-07-27                             |
| From      | AUDIT-ADMIN-UI-R1 G1 / roadmap IMP-033 |
| Freezes   | DSF-002 rev 1.15                       |
| Authority | Solo-operator provisional              |

## Goal

Stop AdminShell from rendering full privileged chrome for any signed-in user who only has a session. Gate on `GET /auth/me` capabilities and filter nav/home cards by permission. **API remains AuthZ truth.**

## Done

- `lib/auth/admin-access.ts` — `canAccessAdminShell`, `visibleAdminNavIds`, `adminDeniedFallback`
- `AdminShell` — session bind → `/auth/me` → deny panel (teacher/parent link) or filtered nav
- Admin home hub cards filtered with the same nav ids
- Unit tests: `admin-access.test.ts`
- DSF-002 AuthZ UX amended (rev 1.15)

## Acceptance

| Criterion                                                            | Status                             |
| -------------------------------------------------------------------- | ---------------------------------- |
| Attendance-only / parent-only cannot see Admin nav or children       | Done (denied panel)                |
| Staff with `finance.*` can open Admin with Fees (not Users/Settings) | Done (nav filter)                  |
| Owner/admin still see full nav                                       | Done                               |
| Fail closed if `/auth/me` errors                                     | Done → denied → teacher            |
| No client AuthZ theater claiming mutations are allowed               | Done — pages still rely on API 403 |

## Out of scope

- Server middleware / RSC AuthZ
- Changing `prefersAdminHome` post-login routing
- IMP-027 primitives / pagination / tables

## Verify

```bash
npx vitest run apps/web/src/lib/auth
npm run typecheck -w @educore/web
```
