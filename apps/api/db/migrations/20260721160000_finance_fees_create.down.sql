-- Down: IMP-009 finance tables.

DELETE FROM role_permissions
WHERE permission_id IN (
  SELECT id FROM permissions WHERE code IN ('finance.read', 'finance.manage', 'finance.reconcile')
);
DELETE FROM permissions WHERE code IN ('finance.read', 'finance.manage', 'finance.reconcile');

DROP TABLE IF EXISTS payment_gateway_events;
DROP TABLE IF EXISTS receipts;
DROP TABLE IF EXISTS payment_allocations;
DROP TABLE IF EXISTS payment_attempts;
DROP TABLE IF EXISTS invoice_lines;
DROP TABLE IF EXISTS invoices;
DROP TABLE IF EXISTS journal_lines;
DROP TABLE IF EXISTS journal_entries;
DROP TABLE IF EXISTS fee_structure_items;
DROP TABLE IF EXISTS fee_structures;
DROP TABLE IF EXISTS chart_of_accounts;
