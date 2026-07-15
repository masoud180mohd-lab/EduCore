-- IMP-001 P3 improvement: /auth/me + select-tenant helpers + login rate-limit store.
-- SECURITY DEFINER only; no Nest business CRUD routes.

-- ---------------------------------------------------------------------------
-- Profile + memberships (for GET /auth/me)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.auth_get_user_profile(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  email citext,
  display_name text,
  status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.email, u.display_name, u.status
  FROM users u
  WHERE u.id = p_user_id
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION app.auth_list_membership_summaries(p_user_id uuid)
RETURNS TABLE (
  tenant_id uuid,
  status text,
  joined_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
  RETURN QUERY
  SELECT m.tenant_id, m.status, m.joined_at
  FROM tenant_memberships m
  WHERE m.user_id = p_user_id
    AND m.status IN ('active', 'invited', 'suspended')
  ORDER BY m.created_at ASC;
END;
$$;

-- ---------------------------------------------------------------------------
-- Rebind session tenant (POST /auth/select-tenant)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.auth_rebind_session_tenant(
  p_session_id uuid,
  p_user_id uuid,
  p_new_tenant_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  updated int;
BEGIN
  IF p_session_id IS NULL OR p_user_id IS NULL OR p_new_tenant_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT app.auth_has_active_membership(p_user_id, p_new_tenant_id) THEN
    RETURN false;
  END IF;

  UPDATE sessions
  SET tenant_id = p_new_tenant_id,
      last_seen_at = now()
  WHERE id = p_session_id
    AND user_id = p_user_id
    AND status = 'active'
    AND expires_at > now();

  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated > 0;
END;
$$;

-- ---------------------------------------------------------------------------
-- Login rate limit ledger (DB-backed; multi-instance safe without Redis)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS app.login_rate_limits (
  rate_key text PRIMARY KEY,
  attempt_count integer NOT NULL,
  window_started_at timestamptz NOT NULL
);

COMMENT ON TABLE app.login_rate_limits IS
  'Auth login brute-force counters. App role has no direct table grants; SECURITY DEFINER only.';

REVOKE ALL ON TABLE app.login_rate_limits FROM PUBLIC;

CREATE OR REPLACE FUNCTION app.auth_rate_limit_status(
  p_key text,
  p_max_attempts integer,
  p_window_seconds integer
)
RETURNS TABLE (allowed boolean, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  rec app.login_rate_limits%ROWTYPE;
  window_end timestamptz;
BEGIN
  IF p_key IS NULL OR p_key = '' THEN
    RETURN QUERY SELECT true, 0;
    RETURN;
  END IF;

  SELECT * INTO rec FROM app.login_rate_limits WHERE rate_key = p_key;
  IF NOT FOUND THEN
    RETURN QUERY SELECT true, 0;
    RETURN;
  END IF;

  window_end := rec.window_started_at + make_interval(secs => p_window_seconds);
  IF now() >= window_end THEN
    DELETE FROM app.login_rate_limits WHERE rate_key = p_key;
    RETURN QUERY SELECT true, 0;
    RETURN;
  END IF;

  IF rec.attempt_count >= p_max_attempts THEN
    RETURN QUERY SELECT false, GREATEST(1, CEIL(EXTRACT(EPOCH FROM (window_end - now())))::integer);
    RETURN;
  END IF;

  RETURN QUERY SELECT true, 0;
END;
$$;

CREATE OR REPLACE FUNCTION app.auth_rate_limit_record_failure(
  p_key text,
  p_max_attempts integer,
  p_window_seconds integer
)
RETURNS TABLE (allowed boolean, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  rec app.login_rate_limits%ROWTYPE;
  window_end timestamptz;
BEGIN
  IF p_key IS NULL OR p_key = '' THEN
    RETURN QUERY SELECT true, 0;
    RETURN;
  END IF;

  SELECT * INTO rec FROM app.login_rate_limits WHERE rate_key = p_key FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO app.login_rate_limits (rate_key, attempt_count, window_started_at)
    VALUES (p_key, 1, now());
    RETURN QUERY SELECT true, 0;
    RETURN;
  END IF;

  window_end := rec.window_started_at + make_interval(secs => p_window_seconds);
  IF now() >= window_end THEN
    UPDATE app.login_rate_limits
    SET attempt_count = 1, window_started_at = now()
    WHERE rate_key = p_key;
    RETURN QUERY SELECT true, 0;
    RETURN;
  END IF;

  UPDATE app.login_rate_limits
  SET attempt_count = attempt_count + 1
  WHERE rate_key = p_key
  RETURNING * INTO rec;

  IF rec.attempt_count >= p_max_attempts THEN
    window_end := rec.window_started_at + make_interval(secs => p_window_seconds);
    RETURN QUERY SELECT false, GREATEST(1, CEIL(EXTRACT(EPOCH FROM (window_end - now())))::integer);
    RETURN;
  END IF;

  RETURN QUERY SELECT true, 0;
END;
$$;

CREATE OR REPLACE FUNCTION app.auth_rate_limit_reset(p_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
  DELETE FROM app.login_rate_limits WHERE rate_key = p_key;
END;
$$;

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT EXECUTE ON FUNCTION app.auth_get_user_profile(uuid) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.auth_list_membership_summaries(uuid) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.auth_rebind_session_tenant(uuid, uuid, uuid) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.auth_rate_limit_status(text, integer, integer) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.auth_rate_limit_record_failure(text, integer, integer) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.auth_rate_limit_reset(text) TO educore_app;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION app.auth_get_user_profile(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.auth_list_membership_summaries(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.auth_rebind_session_tenant(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.auth_rate_limit_status(text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.auth_rate_limit_record_failure(text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.auth_rate_limit_reset(text) FROM PUBLIC;
