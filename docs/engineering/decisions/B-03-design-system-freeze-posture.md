# B-03 — Design System Freeze posture (provisional slices only)

| Field       | Value                                                                 |
| ----------- | --------------------------------------------------------------------- |
| Decision ID | `B-03` / `DSF-POSTURE-001`                                            |
| Status      | **Accepted (solo-operator)** — 2026-08-08 (`GO B03-DSF`)              |
| Date        | 2026-08-08                                                            |
| Program     | Engineering Readiness blocker **B-03** (`42_ENGINEERING_READINESS_REVIEW.md`) |
| Authority   | Solo-operator provisional (SOLO-GOV-001)                              |
| Governing   | `07_DESIGN_SYSTEM.md` · Architecture Freeze Gate 3 · DSF-001…006      |

## Objective

Close readiness **B-03** with an explicit, honest posture: either accept a **kit-wide Design System Freeze v1.0**, or lock **provisional DSF slices only** as a standing residual until a real freeze can be countersigned.

## Options

| ID | Posture | Pros | Cons |
| --- | --- | --- | --- |
| **A** | Accept **kit-wide Design System Freeze v1.0** now | Closes B-03 “green” on paper | **Dishonest** — no single accepted tokens/nav/components/a11y package; would overclaim vs Gate 3 |
| **B** | Lock **provisional DSF-001…006 only** as standing residual | Matches reality; keeps UI gated per slice; clear amendment path | Kit-wide DSF remains open for unrestricted production UI claims |
| **C** | Defer decision | Zero doc work | Leaves B-03 Partial forever; agents keep guessing |

### Decision (Accepted)

**Option B — Provisional DSF slices only.**

| Field | Value |
| --- | --- |
| Kit-wide Design System Freeze | **Not accepted** |
| Allowed UI work | Only inside an existing **provisional** `DSF-00x` (or a new provisional DSF + IMP gate) |
| Tokens / chrome | Per-slice tokens (DSF-001…006); no Tailwind/shadcn redesign without DSF amend |
| Gate 3 completeness | **Incomplete** for unrestricted production role UI |
| Standing residual | B-03 remains a **named residual** until kit-wide DSF v1.0 is authored + Accepted (ideally with independent countersign) |

## Inventory (current provisional slices)

| ID | Scope |
| --- | --- |
| `DSF-001` | Teacher attendance |
| `DSF-002` | Admin guardians (+ shell/academic as documented in slice) |
| `DSF-003` | Teacher marks |
| `DSF-004` | Admin fees |
| `DSF-005` | Parent / guardian fees |
| `DSF-006` | Parent portal |

Principles in `07_DESIGN_SYSTEM.md` guide taste; they are **not** a freeze record.

## Binding rules

1. Do **not** claim “Design System Freeze accepted” for production / public pilot.  
2. New role screens require a **new or amended provisional DSF** before IMP.  
3. Cross-slice visual redesign (new token set, component library swap) requires a DSF amend or a future kit-wide freeze ADR.  
4. Accessibility / offline baselines stay **per-slice** until kit-wide DSF v1.0.  
5. SOLO-GOV-001 signatures on DSF slices ≠ independent Design peer review.

## What would close the residual later (kit-wide DSF v1.0)

Minimum package (Architecture Freeze Gate 3):

- Shared layout rules + design tokens (single source)  
- Role navigation model (admin / teacher / parent / finance)  
- Core components + states (loading / empty / offline / error)  
- Accessibility baseline  
- Acceptance under governance stronger than solo-only when humans exist  

Track as future `DSF-KIT-001` / EPIC-DS-01 — **not** started in this decision.

## Explicit non-goals

- Inventing a fake kit-wide freeze document  
- Redesigning lab UI in this slice  
- Flipping production GO  

## Acceptance (posture only)

- [x] Chose Option B explicitly  
- [x] Inventory of provisional DSF-001…006 named  
- [x] Binding rules for agents/humans  
- [x] Path to future kit-wide freeze named  
- [x] Production / unrestricted UI claims still blocked by this residual + overall readiness NO GO  

## Consequences

1. Mark B-03 **Closed-provisional (posture locked)** — kit-wide DSF residual stands.  
2. Update Known Limitations / project status to match.  
3. Next readiness work is **operator/staging** (B-07 D1) or product residuals (IdP, PAY-OPS), not inventing DSF-KIT unless Owner asks.

## Honesty

Accepted under SOLO-GOV-001. Closing B-03 as “provisional only” is intentional under-claiming, not design completion.
