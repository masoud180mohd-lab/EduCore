# DSF-009 — Student portal (Phase 4a)

| Field | Value |
|-------|--------|
| Status | **Accepted (Phase 4a)** |
| Date | 2026-08-21 |
| Spec | `SPEC-PORTALS-001` Phase 4 |
| Stack | Digii chrome (`DSF-KIT-002`) + Tailwind/shadcn (`DSF-KIT-001` §2.1) |

## 1. Scope (4a — this freeze)

| In | Out (deferred) |
|----|-----------------|
| `students.user_id` bind + `student` role + `student.self.read` | Attendance / results / fees self BFF |
| `GET /api/v1/me/student` | Timetable (SPEC Q3 excluded) |
| Digii `StudentShell` + student home | Admin bind UI polish |
| Preferential routing to `/student` when only/primarily student | Phase 5 Parent refine |

## 2. Isolation (fail-closed)

- Student token must **never** receive staff perms (`student.read`, `marks.*`, …).
- Self endpoints resolve **only** the student row bound via `students.user_id = auth.user_id` in tenant.
- Unbound user → **404** (same shape as parent).

## 3. Chrome

- DigiiShell; **accent** `#0f4c6b` (student slate-teal).
- Nav v1: Home only (+ reserved stubs labelled Coming soon in home body).
- Top actions: theme, language, logout — no create.

## 4. Home v1

- Welcome + bound student display name / code / status.
- Three muted “Coming soon” panels: attendance, results, fees (honest 4a).

## 5. Non-goals

- Public pilot; WhatsApp; marks entry; staff student list for students.
