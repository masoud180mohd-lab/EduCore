# IMP-031 — Admin cross-links

| Field     | Value                                |
| --------- | ------------------------------------ |
| Program   | **IMP-031**                          |
| Date      | 2026-07-28                           |
| From      | AUDIT-ADMIN-UI-R1 G13 / T2           |
| Freezes   | DSF-002 rev 1.22                     |
| Depends   | IMP-012/015/030/033; ACF-008/010/012 |
| Authority | Solo-operator provisional            |

## Goal

Reduce hub hunting: student detail shows **this student's** enrollments + invoices + guardians; invoice detail links **student** + **linked guardians**.

## Cross-link map (DSF-002)

| From           | To            | Route                              | API                            |
| -------------- | ------------- | ---------------------------------- | ------------------------------ |
| Student detail | Enrollment    | `/admin/academic/enrollments/[id]` | `GET /enrollments?studentId=`  |
| Student detail | Invoice       | `/admin/fees/invoices/[id]`        | `GET /invoices?studentId=`     |
| Student detail | Guardian      | `/admin/guardians/[id]`            | `GET /students/{id}/guardians` |
| Invoice detail | Student       | `/admin/students/[id]`             | `invoice.studentId`            |
| Invoice detail | Guardian      | `/admin/guardians/[id]`            | `GET /students/{id}/guardians` |
| Invoice detail | Guardian fees | `/admin/guardians/[id]/fees`       | compose (finance + guardian)   |

## Sections added

| Page                        | Sections                                                                    |
| --------------------------- | --------------------------------------------------------------------------- |
| `students/[studentId]`      | Enrollments, Fees, Guardians (`RelatedRecordsSection` + Load more limit 25) |
| `fees/invoices/[invoiceId]` | Student name link; Linked guardians card                                    |

## Shared helpers

| Piece           | Path                                                      |
| --------------- | --------------------------------------------------------- |
| Path builders   | `apps/web/src/lib/admin/admin-paths.ts`                   |
| Name resolution | `apps/web/src/lib/admin/resolve-related-names.ts`         |
| Section chrome  | `apps/web/src/components/admin/RelatedRecordsSection.tsx` |

## Permission gating

Uses `visibleAdminNavIds` from IMP-033:

- No Academic nav → enrollments section hidden
- No Fees nav → invoices section hidden
- No Guardians nav → guardians sections hidden
- Section-level 403 banners; student edit form unaffected

## Waves

| Wave                         | Status              |
| ---------------------------- | ------------------- |
| L0 discovery + DSF           | Done                |
| L1 student detail            | Done                |
| L2 invoice detail            | Done                |
| L3 tests + check             | Done                |
| Wave X prefill `?studentId=` | **Done** (IMP-031x) |

## Manual QA

1. Open student with enrollments + invoices → sections list rows; Open → detail; back.
2. Student with >25 enrollments → Load more appends.
3. Invoice detail → click student name → student detail.
4. Invoice detail → guardians list → guardian detail; optional Guardian fees link.
5. Finance-only actor: fees section visible; enrollments hidden (no academic nav).

## Doubt checks

| Question                                | Answer                             |
| --------------------------------------- | ---------------------------------- |
| Reach student invoice in ≤2 clicks?     | Yes (student detail → invoice row) |
| Invoice student name navigates?         | Yes (`adminStudentPath` link)      |
| Finance-only sees fees not enrollments? | Yes (nav gate)                     |
| Guardian visible without finance?       | Yes (guardian.read)                |

## Verify

```bash
npx vitest run apps/web/src/lib/admin/admin-paths.test.ts tests/tooling/imp031-admin-crosslinks.test.ts
npm run check
```
