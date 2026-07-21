-- Down: marks write helpers.

DROP FUNCTION IF EXISTS app.set_exam_subject_status(uuid, uuid, uuid, text, text);
DROP FUNCTION IF EXISTS app.upsert_marks(uuid, uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS app.create_exam_subject(uuid, uuid, uuid, uuid, uuid, numeric);
DROP FUNCTION IF EXISTS app.create_exam(uuid, uuid, uuid, text, uuid, uuid, uuid, text);
