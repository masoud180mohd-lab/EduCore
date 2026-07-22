-- Down: finance void / reverse helpers.

DROP FUNCTION IF EXISTS app.reverse_payment(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS app.void_invoice(uuid, uuid, uuid);
