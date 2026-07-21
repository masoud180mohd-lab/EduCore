-- IMP-003-S2: app.create_stream. Table INSERT stays revoked.

CREATE OR REPLACE FUNCTION app.create_stream(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_stream_id uuid,
  p_class_id uuid,
  p_name text,
  p_code text,
  p_status text
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  class_id uuid,
  name text,
  code text,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_stream_id IS NULL OR p_class_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF p_name IS NULL OR char_length(btrim(p_name)) < 1 OR char_length(btrim(p_name)) > 200 THEN
    RAISE EXCEPTION 'invalid name' USING ERRCODE = '22023';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('draft', 'active', 'closed') THEN
    RAISE EXCEPTION 'invalid status' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM classes c WHERE c.id = p_class_id AND c.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'parent class not found' USING ERRCODE = '22023';
  END IF;

  INSERT INTO streams (id, tenant_id, class_id, name, code, status, created_at, updated_at)
  VALUES (
    p_stream_id, p_tenant_id, p_class_id, btrim(p_name),
    NULLIF(btrim(COALESCE(p_code, '')), ''), p_status, now(), now()
  );

  RETURN QUERY
  SELECT s.id, s.tenant_id, s.class_id, s.name, s.code, s.status, s.created_at, s.updated_at
  FROM streams s WHERE s.id = p_stream_id;
END;
$$;

COMMENT ON FUNCTION app.create_stream(uuid, uuid, uuid, uuid, text, text, text) IS
  'S2: Insert stream under class in bound tenant.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT EXECUTE ON FUNCTION app.create_stream(uuid, uuid, uuid, uuid, text, text, text) TO educore_app;
  END IF;
END $$;

REVOKE ALL ON FUNCTION app.create_stream(uuid, uuid, uuid, uuid, text, text, text) FROM PUBLIC;
