-- Down: finance fees write helpers.

DROP FUNCTION IF EXISTS app.post_manual_payment(uuid, uuid, uuid, uuid, uuid, text, bigint, text);
DROP FUNCTION IF EXISTS app.issue_invoice(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS app.create_invoice_draft(uuid, uuid, uuid, uuid, uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS app.create_fee_structure(uuid, uuid, uuid, uuid, text, text, text, jsonb);
DROP FUNCTION IF EXISTS app.ensure_tenant_coa(uuid);
