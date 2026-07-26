-- Down: IMP-024 fee structure update helper.

DROP FUNCTION IF EXISTS app.update_fee_structure(
  uuid, uuid, uuid, boolean, text, boolean, text, boolean, jsonb
);
