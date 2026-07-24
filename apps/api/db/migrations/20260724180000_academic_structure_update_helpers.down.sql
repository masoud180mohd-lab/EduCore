-- Down: IMP-013 academic structure update helpers.

DROP FUNCTION IF EXISTS app.update_subject(uuid, uuid, uuid, boolean, text, boolean, text, boolean, text);
DROP FUNCTION IF EXISTS app.update_stream(uuid, uuid, uuid, boolean, text, boolean, text, boolean, text);
DROP FUNCTION IF EXISTS app.update_class(uuid, uuid, uuid, boolean, text, boolean, text, boolean, text);
DROP FUNCTION IF EXISTS app.update_term(
  uuid, uuid, uuid, boolean, text, boolean, text, boolean, date, boolean, date, boolean, text
);
DROP FUNCTION IF EXISTS app.update_academic_year(
  uuid, uuid, uuid, boolean, text, boolean, text, boolean, date, boolean, date, boolean, text
);
