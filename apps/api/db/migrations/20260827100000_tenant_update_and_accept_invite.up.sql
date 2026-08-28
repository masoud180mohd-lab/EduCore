-- Migration: tenant update and accept invite helpers
-- Provides SECURITY DEFINER functions for accept invite and tenant profile updates.

CREATE OR REPLACE FUNCTION app.auth_accept_invite(
  p_email citext,
  p_password_hash text,
  p_display_name text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  email citext,
  display_name text,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  v_user_id uuid;
  v_status text;
BEGIN
  IF p_email IS NULL OR p_email = '' OR p_password_hash IS NULL OR p_password_hash = '' THEN
    RETURN;
  END IF;

  SELECT u.id, u.status INTO v_user_id, v_status
  FROM users u
  WHERE u.email = p_email
  LIMIT 1;

  IF v_user_id IS NULL OR v_status IN ('disabled', 'locked') THEN
    RETURN;
  END IF;

  UPDATE users
  SET password_hash = p_password_hash,
      status = 'active',
      email_verified_at = COALESCE(email_verified_at, now()),
      display_name = COALESCE(NULLIF(TRIM(p_display_name), ''), display_name),
      updated_at = now()
  WHERE users.id = v_user_id;

  UPDATE tenant_memberships
  SET status = 'active',
      joined_at = COALESCE(joined_at, now()),
      updated_at = now()
  WHERE user_id = v_user_id AND status = 'invited';

  RETURN QUERY
  SELECT u.id, u.email, u.display_name, u.status
  FROM users u
  WHERE u.id = v_user_id;
END;
$$;

COMMENT ON FUNCTION app.auth_accept_invite(citext, text, text) IS
  'Accept invite: sets user password, transitions invited user + memberships to active.';

CREATE OR REPLACE FUNCTION app.tenant_update_profile(
  p_tenant_id uuid,
  p_name text DEFAULT NULL,
  p_timezone text DEFAULT NULL,
  p_primary_locale text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  code text,
  name text,
  status text,
  primary_locale text,
  timezone text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
  IF p_tenant_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE tenants
  SET name = COALESCE(NULLIF(TRIM(p_name), ''), name),
      timezone = COALESCE(NULLIF(TRIM(p_timezone), ''), timezone),
      primary_locale = COALESCE(NULLIF(TRIM(p_primary_locale), ''), primary_locale),
      updated_at = now()
  WHERE tenants.id = p_tenant_id;

  RETURN QUERY
  SELECT t.id, t.code, t.name, t.status, t.primary_locale, t.timezone, t.created_at, t.updated_at
  FROM tenants t
  WHERE t.id = p_tenant_id;
END;
$$;

COMMENT ON FUNCTION app.tenant_update_profile(uuid, text, text, text) IS
  'Update tenant profile (name, timezone, locale) with validation.';

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT EXECUTE ON FUNCTION app.auth_accept_invite(citext, text, text) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.tenant_update_profile(uuid, text, text, text) TO educore_app;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_platform') THEN
    GRANT EXECUTE ON FUNCTION app.auth_accept_invite(citext, text, text) TO educore_platform;
    GRANT EXECUTE ON FUNCTION app.tenant_update_profile(uuid, text, text, text) TO educore_platform;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION app.auth_accept_invite(citext, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.tenant_update_profile(uuid, text, text, text) FROM PUBLIC;
