# IMP-052 — Digii chrome foundation (Tailwind + shadcn + Login/Platform proof)

| Field | Value |
| --- | --- |
| Task | IMP-052 |
| Date | 2026-08-20 |
| Status | **In progress** — Wave 0–2 foundation landed |
| Governing | DSF-KIT-001 v1.7 · DSF-KIT-002 v1.1 · DSF-002 v1.32 · SPEC-PORTALS-001 Phase 1b |

## Summary

Owner GO 2026-08-20: adopt EduNexus-style Digii UI via Tailwind v4 + shadcn primitives across portals (phased). This slice:

1. **Freeze amends** — DSF-KIT-001 §2.1 (stack), DSF-KIT-002 Digii hybrid chrome, DSF-002 Phase 1b note.
2. **Stack** — `tailwindcss`, `@tailwindcss/postcss`, CVA, Lucide, Radix primitives, TanStack Query in `@educore/web`.
3. **Proof UI** — DigiiShell, PlatformShell rewrite, Login card restyle, Platform schools list header polish.
4. **Phase 1b** — AdminShell Digii + Admin home polish; **TeacherShell + ParentShell Digii** (portal accents olive/plum).
5. **Coexistence** — legacy `tokens.css` on many list/detail pages inside Digii shells.

## Status

**Landed:** Login · Platform · Admin · Teacher · Parent Digii chrome. Next product phase per SPEC: Teacher Darasa/Somo modes (Phase 2) after DSF-001/003 amend.

## Verify

- `npm run typecheck -w @educore/web`
- `npm test -w @educore/web`
- Manual: `/login` · `/platform` · `/t/{tenant}/admin` Digii chrome + grouped nav
