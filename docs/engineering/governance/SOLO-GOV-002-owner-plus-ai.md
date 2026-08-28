# Solo-operator + AI — operating model (SOLO-GOV-002)

| Field                  | Value                                                                                                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document ID**        | `SOLO-GOV-002`                                                                                                                                                                    |
| **Date**               | 2026-08-13                                                                                                                                                                        |
| **Status**             | **Active** — supersedes Independent Board / multi-person countersign as a required gate                                                                                           |
| **Supersedes**         | Kit language that assumes a real architecture team, Independent Engineering Review Board, or named countersigners (PM Master / Masoud Salum / Rashid Mohammed as separate humans) |
| **Does not supersede** | Technical rules (RLS, ledger, MFA, no invented ClickPesa keys, no fake restore drills)                                                                                            |

---

## 1. Situation

The AI Development Kit was written as if EduCore had a real team (architects, Security Lead, Backend Lead, Independent Board). **That team does not exist.** Delivery is **Project Owner + this AI**. Named kit roles were placeholders.

Waiting for “independent humans” to re-sign freezes or re-review `42` is waiting for people who were never staffed. Owner directed that those kit elements be ignored / retired.

## 2. Authority now

| Seat                              | Who                   |
| --------------------------------- | --------------------- |
| Human authority                   | Project Owner         |
| Implementer / in-session reviewer | AI agent in this repo |
| Independent architecture Board    | **None — retired**    |

SOLO-GOV-001 remains true (acting seats, not three humans). This note goes further: **do not treat missing independent countersign as an open task.**

## 3. What we delete as a gate (not as files)

Do **not** require, and do **not** invent:

- Independent Engineering Review Board re-review of `42`
- Multi-person freeze re-sign (F-005)
- CODEOWNERS / separate architect / security / backend humans
- “Chat is not the Board” as a reason to refuse Owner-directed work that is otherwise safe

Keep the **files** (`36`, `37`, `42`, freeze packs). They are technical memory. Their **Board / team wrapper is historical fiction**.

## 4. What we do not delete

- Tenant isolation, deny-by-default AuthZ, ledger reversals, MFA for privileged finance
- “Do not invent ClickPesa credentials”
- “Do not claim a restore drill that was not run”
- Slice DBF/ACF/DSF as the contract the Owner+AI already implemented against

## 5. Findings

| ID        | Under SOLO-GOV-002                                                                                 |
| --------- | -------------------------------------------------------------------------------------------------- |
| **F-005** | **Withdrawn** — close condition was independent humans. None exist. Not “closed by fake re-sign.”  |
| **F-001** | **Deferred** (PAY-007) — office cash/bank/cheque is the live path until Owner can afford ClickPesa |
| **F-003** | Still a known limit (Neon PITR 6h vs kit RPO 24h) until Owner upgrades plan or accepts 6h          |
| **F-002** | Already closed in ops (prod MFA hard)                                                              |

## 6. Production / public schools

Retiring the Board is **not** a public-pilot GO. Owner may point lab/prod infra at real schools only after accepting remaining technical residuals in `43_PROJECT_STATUS.md` (office collection, not MoMo; 6h PITR). AI must not stamp “Board GO.”

## 7. Honesty line (use this)

> EduCore is Owner + AI. Kit Board / architect-team language is retired (SOLO-GOV-002). Slice freezes are Owner-accepted. Remaining limits are technical, not missing people.
