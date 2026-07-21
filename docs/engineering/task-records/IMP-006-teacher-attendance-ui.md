# IMP-006 — Teacher Attendance UI (program)

| Field     | Value                     |
| --------- | ------------------------- |
| Program   | IMP-006                   |
| Date      | 2026-07-21                |
| Authority | Solo-operator provisional |

## Outcome

Bootstrap `apps/web` (Next.js App Router) and deliver online teacher attendance against ACF-009.

## Waves

| Wave                  | Status                                   |
| --------------------- | ---------------------------------------- |
| F0 DSF + scaffold     | Done                                     |
| F1 Auth + shell       | Done                                     |
| F2 Open/list sessions | Done                                     |
| F3 Mark + close       | Done                                     |
| F4 Hardening          | Done (unit + tooling + manual QA script) |
| O Offline stubs       | Done (banner + docs)                     |

## Run

```bash
npm run start:dev          # API :3000
npm run dev:web            # Web :3001
```

## Screens

- `/login`
- `/t/[tenantId]/teacher`
- `/t/[tenantId]/teacher/attendance`
- `/t/[tenantId]/teacher/attendance/sessions/[sessionId]`

## Residual

- No Playwright e2e in this program (manual QA script only)
- sessionStorage token threat note in DSF-001
- Name resolution N+1 GET /students/{id} (acceptable MVP)

## Five-axis review (IMP-006-F4c)

| Axis         | Verdict | Notes                                                                  |
| ------------ | ------- | ---------------------------------------------------------------------- |
| Correctness  | Pass    | Consumes ACF-009 ids-only; roster from enrollments; closed = read-only |
| Security     | Pass    | Bearer + X-Tenant-Id; no tokens in repo; sessionStorage threat noted   |
| A11y / UX    | Pass    | Labels on status radios; banners; mobile-first shell                   |
| Tests        | Pass    | API client + mark-state unit; tooling scaffold; `npm run check` green  |
| Docs honesty | Pass    | Provisional DSF; offline stubs only; no false e2e claim                |

### Doubt checks

- Mark non-enrolled student? **No** — UI only renders enrollment roster.
- Retry double-submit without idempotency? **Must not** — keys persisted per action until success.
- Wrong X-Tenant-Id show other school? **Must not** — shell binds session tenant; API enforces.

## Next

Admin shell, guardians, marks UI, or FE e2e against live API.
