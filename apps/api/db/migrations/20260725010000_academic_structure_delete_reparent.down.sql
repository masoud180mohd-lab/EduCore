-- Down: IMP-014 academic structure delete helpers + reparent extensions.
-- Drops the delete_* helpers and the reparent-capable update_term /
-- update_class / update_stream signatures, then restores the IMP-013
-- signatures of update_term / update_class / update_stream verbatim.

DROP FUNCTION IF EXISTS app.delete_academic_year(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS app.delete_term(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS app.delete_class(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS app.delete_stream(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS app.delete_subject(uuid, uuid, uuid);

DROP FUNCTION IF EXISTS app.update_term(
  uuid, uuid, uuid, boolean, text, boolean, text, boolean, date, boolean, date, boolean, text,
  boolean, uuid
);
DROP FUNCTION IF EXISTS app.update_class(
  uuid, uuid, uuid, boolean, text, boolean, text, boolean, text, boolean, uuid, boolean, uuid
);
DROP FUNCTION IF EXISTS app.update_stream(
  uuid, uuid, uuid, boolean, text, boolean, text, boolean, text, boolean, uuid
);

-- Restore IMP-013 signatures (verbatim from
-- 20260724180000_academic_structure_update_helpers.up.sql).

CREATE OR REPLACE FUNCTION app.update_term(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_term_id uuid,
  p_set_name boolean,
  p_name text,
  p_set_code boolean,
  p_code text,
  p_set_starts_on boolean,
  p_starts_on date,
  p_set_ends_on boolean,
  p_ends_on date,
  p_set_status boolean,
  p_status text
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  academic_year_id uuid,
  name text,
  code text,
  starts_on date,
  ends_on date,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  v_starts date;
  v_ends date;
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_term_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT COALESCE(p_set_name, false)
     AND NOT COALESCE(p_set_code, false)
     AND NOT COALESCE(p_set_starts_on, false)
     AND NOT COALESCE(p_set_ends_on, false)
     AND NOT COALESCE(p_set_status, false) THEN
    RAISE EXCEPTION 'no fields to update' USING ERRCODE = '22023';
  END IF;
  IF p_set_name THEN
    IF p_name IS NULL OR char_length(btrim(p_name)) < 1 OR char_length(btrim(p_name)) > 200 THEN
      RAISE EXCEPTION 'invalid name' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF p_set_status THEN
    IF p_status IS NULL OR p_status NOT IN ('draft', 'active', 'closed') THEN
      RAISE EXCEPTION 'invalid status' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM terms t WHERE t.id = p_term_id AND t.tenant_id = p_tenant_id
  ) THEN
    RETURN;
  END IF;

  SELECT t.starts_on, t.ends_on INTO v_starts, v_ends
  FROM terms t WHERE t.id = p_term_id AND t.tenant_id = p_tenant_id;
  IF p_set_starts_on THEN v_starts := p_starts_on; END IF;
  IF p_set_ends_on THEN v_ends := p_ends_on; END IF;
  IF v_starts IS NOT NULL AND v_ends IS NOT NULL AND v_ends < v_starts THEN
    RAISE EXCEPTION 'ends_on before starts_on' USING ERRCODE = '22023';
  END IF;

  UPDATE terms t
  SET
    name = CASE WHEN p_set_name THEN btrim(p_name) ELSE t.name END,
    code = CASE
      WHEN p_set_code THEN NULLIF(btrim(COALESCE(p_code, '')), '')
      ELSE t.code
    END,
    starts_on = CASE WHEN p_set_starts_on THEN p_starts_on ELSE t.starts_on END,
    ends_on = CASE WHEN p_set_ends_on THEN p_ends_on ELSE t.ends_on END,
    status = CASE WHEN p_set_status THEN p_status ELSE t.status END,
    updated_at = now()
  WHERE t.id = p_term_id AND t.tenant_id = p_tenant_id;

  RETURN QUERY
  SELECT t.id, t.tenant_id, t.academic_year_id, t.name, t.code, t.starts_on, t.ends_on,
         t.status, t.created_at, t.updated_at
  FROM terms t
  WHERE t.id = p_term_id AND t.tenant_id = p_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.update_class(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_class_id uuid,
  p_set_name boolean,
  p_name text,
  p_set_code boolean,
  p_code text,
  p_set_status boolean,
  p_status text
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  academic_year_id uuid,
  term_id uuid,
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
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_class_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT COALESCE(p_set_name, false)
     AND NOT COALESCE(p_set_code, false)
     AND NOT COALESCE(p_set_status, false) THEN
    RAISE EXCEPTION 'no fields to update' USING ERRCODE = '22023';
  END IF;
  IF p_set_name THEN
    IF p_name IS NULL OR char_length(btrim(p_name)) < 1 OR char_length(btrim(p_name)) > 200 THEN
      RAISE EXCEPTION 'invalid name' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF p_set_status THEN
    IF p_status IS NULL OR p_status NOT IN ('draft', 'active', 'closed') THEN
      RAISE EXCEPTION 'invalid status' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM classes c WHERE c.id = p_class_id AND c.tenant_id = p_tenant_id
  ) THEN
    RETURN;
  END IF;

  UPDATE classes c
  SET
    name = CASE WHEN p_set_name THEN btrim(p_name) ELSE c.name END,
    code = CASE
      WHEN p_set_code THEN NULLIF(btrim(COALESCE(p_code, '')), '')
      ELSE c.code
    END,
    status = CASE WHEN p_set_status THEN p_status ELSE c.status END,
    updated_at = now()
  WHERE c.id = p_class_id AND c.tenant_id = p_tenant_id;

  RETURN QUERY
  SELECT c.id, c.tenant_id, c.academic_year_id, c.term_id, c.name, c.code, c.status,
         c.created_at, c.updated_at
  FROM classes c
  WHERE c.id = p_class_id AND c.tenant_id = p_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.update_stream(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_stream_id uuid,
  p_set_name boolean,
  p_name text,
  p_set_code boolean,
  p_code text,
  p_set_status boolean,
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
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_stream_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT COALESCE(p_set_name, false)
     AND NOT COALESCE(p_set_code, false)
     AND NOT COALESCE(p_set_status, false) THEN
    RAISE EXCEPTION 'no fields to update' USING ERRCODE = '22023';
  END IF;
  IF p_set_name THEN
    IF p_name IS NULL OR char_length(btrim(p_name)) < 1 OR char_length(btrim(p_name)) > 200 THEN
      RAISE EXCEPTION 'invalid name' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF p_set_status THEN
    IF p_status IS NULL OR p_status NOT IN ('draft', 'active', 'closed') THEN
      RAISE EXCEPTION 'invalid status' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM streams s WHERE s.id = p_stream_id AND s.tenant_id = p_tenant_id
  ) THEN
    RETURN;
  END IF;

  UPDATE streams s
  SET
    name = CASE WHEN p_set_name THEN btrim(p_name) ELSE s.name END,
    code = CASE
      WHEN p_set_code THEN NULLIF(btrim(COALESCE(p_code, '')), '')
      ELSE s.code
    END,
    status = CASE WHEN p_set_status THEN p_status ELSE s.status END,
    updated_at = now()
  WHERE s.id = p_stream_id AND s.tenant_id = p_tenant_id;

  RETURN QUERY
  SELECT s.id, s.tenant_id, s.class_id, s.name, s.code, s.status, s.created_at, s.updated_at
  FROM streams s
  WHERE s.id = p_stream_id AND s.tenant_id = p_tenant_id;
END;
$$;

COMMENT ON FUNCTION app.update_term(
  uuid, uuid, uuid, boolean, text, boolean, text, boolean, date, boolean, date, boolean, text
) IS 'IMP-013: Partial update term. SECURITY DEFINER; empty if missing.';

COMMENT ON FUNCTION app.update_class(
  uuid, uuid, uuid, boolean, text, boolean, text, boolean, text
) IS 'IMP-013: Partial update class. SECURITY DEFINER; empty if missing.';

COMMENT ON FUNCTION app.update_stream(
  uuid, uuid, uuid, boolean, text, boolean, text, boolean, text
) IS 'IMP-013: Partial update stream. SECURITY DEFINER; empty if missing.';

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT EXECUTE ON FUNCTION app.update_term(
      uuid, uuid, uuid, boolean, text, boolean, text, boolean, date, boolean, date, boolean, text
    ) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.update_class(
      uuid, uuid, uuid, boolean, text, boolean, text, boolean, text
    ) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.update_stream(
      uuid, uuid, uuid, boolean, text, boolean, text, boolean, text
    ) TO educore_app;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION app.update_term(
  uuid, uuid, uuid, boolean, text, boolean, text, boolean, date, boolean, date, boolean, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.update_class(
  uuid, uuid, uuid, boolean, text, boolean, text, boolean, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.update_stream(
  uuid, uuid, uuid, boolean, text, boolean, text, boolean, text
) FROM PUBLIC;
