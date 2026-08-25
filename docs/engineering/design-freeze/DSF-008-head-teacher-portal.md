# DSF-008 — Head Teacher Portal (Phase 3a screen inventory)

| Field     | Value                                                                 |
| --------- | --------------------------------------------------------------------- |
| Freeze ID | `DSF-008`                                                             |
| Version   | `1.0`                                                                 |
| Date      | 2026-08-20                                                            |
| Status    | **Accepted — Owner GO implied by “tuendelee” after Phase 2** (SOLO-GOV) |
| Governing | SPEC-PORTALS-001 P4/P5 · DSF-KIT-001/002 · ACF-011 marks · existing summary GETs |

**Honesty:** Phase **3a** ships Head chrome + dashboard (composed summaries) + marks approvals against **existing** APIs. Dedicated Head KPI BFF, exception aggregates, school audit, and **delegation (7 Bible fields)** are **deferred** — listed below as out of scope until ACF/DBF land. Production/public pilot remains NO GO.

## Shell

`HeadShell` — Digii hybrid (DSF-KIT-002 v1.1); identity tint `--portal-accent: #8a5a13` (amber). Wordmark `EduCore · Head` / `Mwalimu Mkuu`. Access: `marks.approve` **or** owner/admin role (lab mapping until a dedicated headmaster role exists).

Nav (Phase 3a subset):

```
Mwalimu Mkuu
├── Dashibodi (Dashboard)
└── Vibali (Approvals — marks)
```

Deferred rail items: Hoja (Exceptions), Ripoti, Ukaguzi, Delegations UI.

## Screens (v1 / 3a)

| # | Screen | Route | Contents / actions |
| --- | --- | --- | --- |
| 1 | Dashboard | `/t/:id/head` | KPI tiles from existing summaries when permitted: students total, fee collected/outstanding/overdue, attendance today. Empty/forbidden states per DSF-KIT-001. Not a dedicated Head BFF. |
| 2 | Marks approvals | `/t/:id/head/approvals` | Queue of exam-subjects in `submitted` status (compose exams → subjects). **Approve** via `POST /api/v1/exam-subjects/:id/approve` (`marks.approve`). ConfirmDialog. Success banner + refresh. |

## Explicit deny (product rule)

Approver must not approve marks they submitted as a teacher (SPEC P4 JTBD 2). **Phase 3a:** UI documents the rule; API self-approval deny is a follow-up golden test if not already enforced server-side.

## Out of scope (3a)

- Delegation create/list (DBF/ACF for 7 fields)
- Exception aggregates / ledger drill-down
- Head-only KPI BFF / at-risk scoring
- Deputy delegation banner
- Changing Admin IA

## Acceptance

- [x] Digii HeadShell + amber tint
- [x] Dashboard composed from existing summaries
- [x] Approvals list + approve action
- [ ] Delegation + KPI BFF + exceptions (later IMP)

## Amendments

| Ver | Date | Notes |
| --- | --- | --- |
| 1.0 | 2026-08-20 | Phase 3a inventory — existing APIs only |
