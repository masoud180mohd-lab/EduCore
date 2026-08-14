# IMP-048 — Dashboard KPIs, Students/Fees i18n, report-card PDF

| Field     | Value |
| --------- | ----- |
| Program   | **IMP-048** |
| Date      | 2026-08-14 |
| Status    | **Done** (solo-operator provisional) |
| Freezes   | ACF-002 v1.4 · ACF-009 v1.4 · ACF-011 v1.2 · ACF-012 v1.8 · DSF-KIT-001 v1.3 · DSF-002 v1.29 |
| Depends   | IMP-047 chrome i18n/theme |
| Authority | Owner + AI (SOLO-GOV-002) |

## Outcome

Ship honest Admin dashboard figures, full EN/SW chrome on Students and Fees, and printable/PDF report cards from approved exam marks — without inventing list COUNTs or a stored grade column.

## Delivered

| Area | Detail |
| ---- | ------ |
| KPIs | `GET /students/summary`, `/invoices/summary`, `/attendance-sessions/summary` in owning modules; Admin home tiles (403-tolerant) |
| i18n | Students list/detail + Fees hub/invoices/structures/receipts use the EN/SW catalog |
| Report cards | Compose from `marks` + `exam_subjects`; derived A/B/C/D/F; JSON + PDF 1.4; Admin pick-exam UI |
| Responsive | `.kpi-grid` auto-fill / stack &lt;768; top-bar wrap; `@media print` hides rail |

## Honesty limits

- Announcements and analytics Reports pages remain placeholders.
- Letter grade is **derived**, not stored.
- Overdue invoices: issued/partially_paid with `issued_at` older than **30 UTC days** (no `due_date` column).
