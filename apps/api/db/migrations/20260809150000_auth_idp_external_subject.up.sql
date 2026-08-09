-- ID-003: Auth0 sub ↔ users.external_subject_id lookup + first-link helpers.

CREATE OR REPLACE FUNCTION app.auth_lookup_user_by_external_subject(p_external_subject_id text)
RETURNS TABLE (
  id uuid,
  email citext,
  display_name text,
  status text,
  password_hash text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
  IF p_external_subject_id IS NULL OR btrim(p_external_subject_id) = '' THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT u.id, u.email, u.display_name, u.status, u.password_hash
  FROM users u
  WHERE u.external_subject_id = btrim(p_external_subject_id)
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION app.auth_lookup_user_by_external_subject(text) IS
  'IdP login helper: fetch user by Auth0/OIDC sub (users.external_subject_id). SECURITY DEFINER.';

CREATE OR REPLACE FUNCTION app.auth_link_external_subject(
  p_user_id uuid,
  p_external_subject_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  updated int;
  subject text;
BEGIN
  subject := btrim(COALESCE(p_external_subject_id, ''));
  IF p_user_id IS NULL OR subject = '' THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM users u
    WHERE u.external_subject_id = subject
      AND u.id <> p_user_id
  ) THEN
    RETURN false;
  END IF;

  UPDATE users u
  SET external_subject_id = subject,
      updated_at = now()
  WHERE u.id = p_user_id
    AND u.status = 'active'
    AND (u.external_subject_id IS NULL OR u.external_subject_id = subject);

  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated > 0;
END;
$$;

COMMENT ON FUNCTION app.auth_link_external_subject(uuid, text) IS
  'IdP first-link: set users.external_subject_id when unset or already equal. SECURITY DEFINER.';

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT EXECUTE ON FUNCTION app.auth_lookup_user_by_external_subject(text) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.auth_link_external_subject(uuid, text) TO educore_app;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION app.auth_lookup_user_by_external_subject(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.auth_link_external_subject(uuid, text) FROM PUBLIC;
