-- Down: guardians write helpers.

DROP FUNCTION IF EXISTS app.end_student_guardian_link(uuid, uuid, uuid, uuid);
DROP FUNCTION IF EXISTS app.create_student_guardian_link(uuid, uuid, uuid, uuid, uuid, text, boolean);
DROP FUNCTION IF EXISTS app.update_guardian(
  uuid, uuid, uuid, boolean, text, boolean, text, boolean, text, boolean, text
);
DROP FUNCTION IF EXISTS app.create_guardian(uuid, uuid, uuid, text, text, text, text);
