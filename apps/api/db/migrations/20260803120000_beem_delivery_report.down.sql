-- COMMS-004 down: drop Beem DLR helper.

DROP FUNCTION IF EXISTS app.apply_beem_delivery_report(text, text, text, text);
