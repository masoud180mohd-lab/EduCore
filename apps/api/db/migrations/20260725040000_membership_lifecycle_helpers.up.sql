-- IMP-020: Membership suspend / reactivate / remove SECURITY DEFINER helpers.
-- educore_app has no direct UPDATE on tenant_memberships for product writes via Nest.

-- ---------------------------------------------------------------------------
-- Suspend: active|invited → suspended (idempotent when already suspended)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.suspend_membership(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_membership_id uuid
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  user_id uuid,
  status text,
  joined_at timestamptz,
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
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_membership_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;

  SELECT m.status INTO v_status
  FROM tenant_memberships m
  WHERE m.id = p_membership_id
    AND m.tenant_id = p_tenant_id;

  IF v_status IS NULL THEN
    RETURN;
  END IF;

  IF v_status = 'suspended' THEN
    RETURN QUERY
    SELECT m.id, m.tenant_id, m.user_id, m.status, m.joined_at, m.created_at, m.updated_at
    FROM tenant_memberships m
    WHERE m.id = p_membership_id AND m.tenant_id = p_tenant_id;
    RETURN;
  END IF;

  IF v_status NOT IN ('active', 'invited') THEN
    RETURN;
  END IF;

  UPDATE tenant_memberships m
  SET status = 'suspended',
      updated_at = now()
  WHERE m.id = p_membership_id
    AND m.tenant_id = p_tenant_id;

  RETURN QUERY
  SELECT m.id, m.tenant_id, m.user_id, m.status, m.joined_at, m.created_at, m.updated_at
  FROM tenant_memberships m
  WHERE m.id = p_membership_id AND m.tenant_id = p_tenant_id;
END;
$$;

COMMENT ON FUNCTION app.suspend_membership(uuid, uuid, uuid) IS
  'IMP-020: Suspend membership (active|invited→suspended). Idempotent. SECURITY DEFINER; AuthZ user.manage + reject self in Nest.';

-- ---------------------------------------------------------------------------
-- Reactivate: suspended → active (set joined_at if null); idempotent when active
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.reactivate_membership(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_membership_id uuid
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  user_id uuid,
  status text,
  joined_at timestamptz,
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
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_membership_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;

  SELECT m.status INTO v_status
  FROM tenant_memberships m
  WHERE m.id = p_membership_id
    AND m.tenant_id = p_tenant_id;

  IF v_status IS NULL THEN
    RETURN;
  END IF;

  IF v_status = 'active' THEN
    RETURN QUERY
    SELECT m.id, m.tenant_id, m.user_id, m.status, m.joined_at, m.created_at, m.updated_at
    FROM tenant_memberships m
    WHERE m.id = p_membership_id AND m.tenant_id = p_tenant_id;
    RETURN;
  END IF;

  IF v_status <> 'suspended' THEN
    RETURN;
  END IF;

  UPDATE tenant_memberships m
  SET status = 'active',
      joined_at = COALESCE(m.joined_at, now()),
      updated_at = now()
  WHERE m.id = p_membership_id
    AND m.tenant_id = p_tenant_id;

  RETURN QUERY
  SELECT m.id, m.tenant_id, m.user_id, m.status, m.joined_at, m.created_at, m.updated_at
  FROM tenant_memberships m
  WHERE m.id = p_membership_id AND m.tenant_id = p_tenant_id;
END;
$$;

COMMENT ON FUNCTION app.reactivate_membership(uuid, uuid, uuid) IS
  'IMP-020: Reactivate membership (suspended→active). Sets joined_at if null. Idempotent when already active. SECURITY DEFINER; AuthZ user.manage in Nest.';

-- ---------------------------------------------------------------------------
-- Remove: soft status → removed (idempotent when already removed); leave user_roles
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.remove_membership(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_membership_id uuid
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  user_id uuid,
  status text,
  joined_at timestamptz,
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
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_membership_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;

  SELECT m.status INTO v_status
  FROM tenant_memberships m
  WHERE m.id = p_membership_id
    AND m.tenant_id = p_tenant_id;

  IF v_status IS NULL THEN
    RETURN;
  END IF;

  IF v_status = 'removed' THEN
    RETURN QUERY
    SELECT m.id, m.tenant_id, m.user_id, m.status, m.joined_at, m.created_at, m.updated_at
    FROM tenant_memberships m
    WHERE m.id = p_membership_id AND m.tenant_id = p_tenant_id;
    RETURN;
  END IF;

  UPDATE tenant_memberships m
  SET status = 'removed',
      updated_at = now()
  WHERE m.id = p_membership_id
    AND m.tenant_id = p_tenant_id;

  RETURN QUERY
  SELECT m.id, m.tenant_id, m.user_id, m.status, m.joined_at, m.created_at, m.updated_at
  FROM tenant_memberships m
  WHERE m.id = p_membership_id AND m.tenant_id = p_tenant_id;
END;
$$;

COMMENT ON FUNCTION app.remove_membership(uuid, uuid, uuid) IS
  'IMP-020: Soft-remove membership (status→removed). Leaves user_roles. Idempotent. SECURITY DEFINER; AuthZ user.manage + reject self in Nest.';

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT EXECUTE ON FUNCTION app.suspend_membership(uuid, uuid, uuid) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.reactivate_membership(uuid, uuid, uuid) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.remove_membership(uuid, uuid, uuid) TO educore_app;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION app.suspend_membership(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.reactivate_membership(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.remove_membership(uuid, uuid, uuid) FROM PUBLIC;
