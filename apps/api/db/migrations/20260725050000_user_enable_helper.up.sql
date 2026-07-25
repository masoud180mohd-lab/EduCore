-- IMP-021: Enable (re-activate) a disabled user. Mirror of app.disable_user.

CREATE OR REPLACE FUNCTION app.enable_user(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_target_user_id uuid
)
RETURNS TABLE (
  id uuid,
  email citext,
  display_name text,
  status text,
  email_verified_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  v_status text;
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;
  -- Visibility: target must have active membership in bound tenant.
  IF NOT EXISTS (
    SELECT 1
    FROM tenant_memberships m
    WHERE m.user_id = p_target_user_id
      AND m.tenant_id = p_tenant_id
      AND m.status = 'active'
  ) THEN
    RETURN;
  END IF;

  SELECT u.status INTO v_status
  FROM users u
  WHERE u.id = p_target_user_id;

  IF v_status IS NULL THEN
    RETURN;
  END IF;

  -- Idempotent when already active.
  IF v_status = 'active' THEN
    RETURN QUERY
    SELECT u.id, u.email, u.display_name, u.status,
           u.email_verified_at, u.last_login_at, u.created_at, u.updated_at
    FROM users u
    WHERE u.id = p_target_user_id;
    RETURN;
  END IF;

  -- Only disabled → active; invited/locked → empty (Nest 404).
  IF v_status <> 'disabled' THEN
    RETURN;
  END IF;

  UPDATE users u
  SET status = 'active',
      updated_at = now()
  WHERE u.id = p_target_user_id;

  RETURN QUERY
  SELECT u.id, u.email, u.display_name, u.status,
         u.email_verified_at, u.last_login_at, u.created_at, u.updated_at
  FROM users u
  WHERE u.id = p_target_user_id;
END;
$$;

COMMENT ON FUNCTION app.enable_user(uuid, uuid, uuid) IS
  'IMP-021: Set user status disabled→active. Idempotent when active. SECURITY DEFINER; AuthZ user.manage + reject self in Nest.';

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT EXECUTE ON FUNCTION app.enable_user(uuid, uuid, uuid) TO educore_app;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION app.enable_user(uuid, uuid, uuid) FROM PUBLIC;
