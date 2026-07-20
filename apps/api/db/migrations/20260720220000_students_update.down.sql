-- Reverse IMP-002-P3 / DBF-002 rev 1.2 update helper only.

DROP FUNCTION IF EXISTS app.update_student(
  uuid, uuid, uuid, boolean, text, boolean, text, boolean, text
);
