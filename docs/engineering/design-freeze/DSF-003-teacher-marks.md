# DSF-003 — Teacher Marks UI (provisional)

| Field     | Value                                    |
| --------- | ---------------------------------------- |
| Freeze ID | `DSF-003`                                |
| Version   | `1.2`                                    |
| Date      | 2026-08-20                               |
| Audience  | Teacher / staff (mobile-first)           |
| Authority | Solo-operator provisional (SOLO-GOV-001) |

**Honesty:** Provisional slice for IMP-008 only. Reuses DSF-001 tokens; does not accept kit-wide Design System Freeze.

## Goal

Fast online marks entry for a class exam/subject — pick exam → subject → enter scores → save → submit.

## Tokens

Reuse DSF-001 CSS variables. No purple-on-white AI defaults.

## Screens

1. **Marks home (Subject mode / Somo)** — list open exams (or create if permitted); entered via Teacher Workspace Somo tab
2. **Exam detail** — subjects + status chips (draft / submitted / approved)
3. **Mark entry** — roster (active enrollments) + numeric score + save + submit
4. **Submitted/approved** — read-only scores; admin may approve from same screen if permitted; UI shows locked state (no editable field) when approved

Mode tabs / defaulting / capability visibility: see DSF-001 v1.2 (shared TeacherShell). This freeze owns Somo surfaces only.

## Components

- Reuse TeacherShell (+ Marks nav)
- ScoreField (number input, labeled)
- StatusChip for exam-subject workflow
- Banner / empty / forbidden states
- **ConfirmDialog** for Submit (shared admin primitive; Esc / Cancel focus / danger)

## AuthZ UX

- 401 → sign in again
- 403 → no access
- 409 when editing submitted/approved → clear locked copy

## Non-goals

- Report cards, offline marks queue, parent results view
- Full teacher_assignments matrix
- Fees / finance chrome

## Solo-operator honesty

Acting seats only.

## Revisions

| Ver | Date       | Notes                                      |
| --- | ---------- | ------------------------------------------ |
| 1.0 | 2026-07-21 | Initial provisional freeze (IMP-008)       |
| 1.1 | 2026-07-30 | Submit uses ConfirmDialog (IMP-034 Wave X) |
| 1.2 | 2026-08-20 | Subject mode (Somo) under Teacher Workspace tabs (SPEC D1 / Phase 2) |
