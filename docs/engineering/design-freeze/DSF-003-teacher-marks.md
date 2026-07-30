# DSF-003 — Teacher Marks UI (provisional)

| Field     | Value                                    |
| --------- | ---------------------------------------- |
| Freeze ID | `DSF-003`                                |
| Version   | `1.1`                                    |
| Date      | 2026-07-21                               |
| Audience  | Teacher / staff (mobile-first)           |
| Authority | Solo-operator provisional (SOLO-GOV-001) |

**Honesty:** Provisional slice for IMP-008 only. Reuses DSF-001 tokens; does not accept kit-wide Design System Freeze.

## Goal

Fast online marks entry for a class exam/subject — pick exam → subject → enter scores → save → submit.

## Tokens

Reuse DSF-001 CSS variables. No purple-on-white AI defaults.

## Screens

1. **Marks home** — list open exams (or create if permitted)
2. **Exam detail** — subjects + status chips (draft / submitted / approved)
3. **Mark entry** — roster (active enrollments) + numeric score + save + submit
4. **Submitted/approved** — read-only scores; admin may approve from same screen if permitted

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
