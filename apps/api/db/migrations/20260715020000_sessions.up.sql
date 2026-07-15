-- IMP-001-T08 / P3 AuthN: sessions table (DBF-001) + refresh hash extension + auth helpers.
-- Nest runtime uses educore_app + SECURITY DEFINER auth functions only (no superuser pool).

CREATE TABLE sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id),
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  session_token_hash text NOT NULL,
  refresh_token_hash text NOT NULL,
  status text NOT NULL,
  ip inet NULL,
  user_agent text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  refresh_expires_at timestamptz NOT NULL,
  revoked_at timestamptz NULL,
  last_seen_at timestamptz NULL,
  CONSTRAINT uq_sessions_session_token_hash UNIQUE (session_token_hash),
  CONSTRAINT uq_sessions_refresh_token_hash UNIQUE (refresh_token_hash),
  CONSTRAINT ck_sessions_status CHECK (status IN ('active', 'revoked', 'expired'))
);

COMMENT ON TABLE sessions IS
  'Identity And Access: authenticated sessions (DBF-001). Access + refresh token hashes only.';

COMMENT ON COLUMN sessions.session_token_hash IS
  'SHA-256 (hex) of opaque access token. Never store raw tokens.';

COMMENT ON COLUMN sessions.refresh_token_hash IS
  'SHA-256 (hex) of opaque refresh token. Rotated on refresh. Never store raw tokens.';

CREATE INDEX ix_sessions_user_status ON sessions (user_id, status);
CREATE INDEX ix_sessions_tenant_status ON sessions (tenant_id, status);
CREATE INDEX ix_sessions_expires_at ON sessions (expires_at);

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT SELECT, UPDATE ON TABLE sessions TO educore_app;
    REVOKE INSERT, DELETE ON TABLE sessions FROM educore_app;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_platform') THEN
    GRANT SELECT, UPDATE ON TABLE sessions TO educore_platform;
    REVOKE INSERT, DELETE ON TABLE sessions FROM educore_platform;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_migrator') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE sessions TO educore_migrator;
  END IF;
END
$$;

REVOKE ALL ON TABLE sessions FROM PUBLIC;

SELECT app.enable_tenant_rls('sessions'::regclass);

-- Own-row + current-tenant visibility (list/self-service later).
DROP POLICY IF EXISTS rls_sessions_select ON sessions;
CREATE POLICY rls_sessions_select
  ON sessions
  FOR SELECT
  TO educore_app
  USING (
    user_id = app.current_user_id()
    OR (
      tenant_id = app.current_tenant_id()
      AND user_id = app.current_user_id()
    )
  );

DROP POLICY IF EXISTS rls_sessions_select_platform ON sessions;
CREATE POLICY rls_sessions_select_platform
  ON sessions
  FOR SELECT
  TO educore_platform
  USING (app.is_trusted_platform_session());

DROP POLICY IF EXISTS rls_sessions_update ON sessions;
CREATE POLICY rls_sessions_update
  ON sessions
  FOR UPDATE
  TO educore_app
  USING (user_id = app.current_user_id())
  WITH CHECK (user_id = app.current_user_id());

-- No INSERT policy for educore_app: session creation only via SECURITY DEFINER helpers.

-- ---------------------------------------------------------------------------
-- Auth helpers (SECURITY DEFINER — pre-auth + token lookup without spoofable GUCs)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.auth_lookup_user_by_email(p_email citext)
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
  RETURN QUERY
  SELECT u.id, u.email, u.display_name, u.status, u.password_hash
  FROM users u
  WHERE u.email = p_email
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION app.auth_lookup_user_by_email(citext) IS
  'Login helper: fetch user credentials by email. SECURITY DEFINER. Never expose via HTTP raw.';

CREATE OR REPLACE FUNCTION app.auth_list_active_membership_tenants(p_user_id uuid)
RETURNS TABLE (tenant_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
  RETURN QUERY
  SELECT m.tenant_id
  FROM tenant_memberships m
  WHERE m.user_id = p_user_id
    AND m.status = 'active';
END;
$$;

CREATE OR REPLACE FUNCTION app.auth_has_active_membership(p_user_id uuid, p_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
  IF p_user_id IS NULL OR p_tenant_id IS NULL THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM tenant_memberships m
    WHERE m.user_id = p_user_id
      AND m.tenant_id = p_tenant_id
      AND m.status = 'active'
  );
END;
$$;

CREATE OR REPLACE FUNCTION app.auth_create_session(
  p_id uuid,
  p_user_id uuid,
  p_tenant_id uuid,
  p_session_token_hash text,
  p_refresh_token_hash text,
  p_expires_at timestamptz,
  p_refresh_expires_at timestamptz,
  p_ip inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
  IF p_id IS NULL OR p_user_id IS NULL OR p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'invalid session parameters';
  END IF;
  IF NOT app.auth_has_active_membership(p_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required';
  END IF;

  INSERT INTO sessions (
    id, user_id, tenant_id, session_token_hash, refresh_token_hash,
    status, ip, user_agent, created_at, expires_at, refresh_expires_at, last_seen_at
  ) VALUES (
    p_id, p_user_id, p_tenant_id, p_session_token_hash, p_refresh_token_hash,
    'active', p_ip, p_user_agent, now(), p_expires_at, p_refresh_expires_at, now()
  );

  UPDATE users
  SET last_login_at = now(), updated_at = now()
  WHERE id = p_user_id;

  RETURN p_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.auth_find_session_by_access_hash(p_hash text)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  tenant_id uuid,
  status text,
  expires_at timestamptz,
  refresh_expires_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.user_id, s.tenant_id, s.status, s.expires_at, s.refresh_expires_at
  FROM sessions s
  WHERE s.session_token_hash = p_hash
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION app.auth_find_session_by_refresh_hash(p_hash text)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  tenant_id uuid,
  status text,
  expires_at timestamptz,
  refresh_expires_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.user_id, s.tenant_id, s.status, s.expires_at, s.refresh_expires_at
  FROM sessions s
  WHERE s.refresh_token_hash = p_hash
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION app.auth_touch_session(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
  UPDATE sessions
  SET last_seen_at = now()
  WHERE id = p_session_id
    AND status = 'active';
END;
$$;

CREATE OR REPLACE FUNCTION app.auth_revoke_session(p_session_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  updated int;
BEGIN
  UPDATE sessions
  SET status = 'revoked',
      revoked_at = now()
  WHERE id = p_session_id
    AND user_id = p_user_id
    AND status = 'active';
  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated > 0;
END;
$$;

CREATE OR REPLACE FUNCTION app.auth_rotate_session_tokens(
  p_session_id uuid,
  p_expected_refresh_hash text,
  p_new_access_hash text,
  p_new_refresh_hash text,
  p_access_expires_at timestamptz,
  p_refresh_expires_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  updated int;
BEGIN
  UPDATE sessions
  SET session_token_hash = p_new_access_hash,
      refresh_token_hash = p_new_refresh_hash,
      expires_at = p_access_expires_at,
      refresh_expires_at = p_refresh_expires_at,
      last_seen_at = now()
  WHERE id = p_session_id
    AND refresh_token_hash = p_expected_refresh_hash
    AND status = 'active'
    AND refresh_expires_at > now();
  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated > 0;
END;
$$;

-- Grant execute to runtime role; revoke public.
DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT EXECUTE ON FUNCTION app.auth_lookup_user_by_email(citext) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.auth_list_active_membership_tenants(uuid) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.auth_has_active_membership(uuid, uuid) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.auth_create_session(uuid, uuid, uuid, text, text, timestamptz, timestamptz, inet, text) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.auth_find_session_by_access_hash(text) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.auth_find_session_by_refresh_hash(text) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.auth_touch_session(uuid) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.auth_revoke_session(uuid, uuid) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.auth_rotate_session_tokens(uuid, text, text, text, timestamptz, timestamptz) TO educore_app;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION app.auth_lookup_user_by_email(citext) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.auth_list_active_membership_tenants(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.auth_has_active_membership(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.auth_create_session(uuid, uuid, uuid, text, text, timestamptz, timestamptz, inet, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.auth_find_session_by_access_hash(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.auth_find_session_by_refresh_hash(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.auth_touch_session(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.auth_revoke_session(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.auth_rotate_session_tokens(uuid, text, text, text, timestamptz, timestamptz) FROM PUBLIC;
