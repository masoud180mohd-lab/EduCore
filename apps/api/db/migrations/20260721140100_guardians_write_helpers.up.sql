-- IMP-007-G1 write helpers for guardians + links.

CREATE OR REPLACE FUNCTION app.create_guardian(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_guardian_id uuid,
  p_display_name text,
  p_phone text,
  p_email text,
  p_status text
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  display_name text,
  phone text,
  email text,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_guardian_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF p_display_name IS NULL
     OR char_length(btrim(p_display_name)) < 1
     OR char_length(btrim(p_display_name)) > 200 THEN
    RAISE EXCEPTION 'invalid display_name' USING ERRCODE = '22023';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('active', 'inactive') THEN
    RAISE EXCEPTION 'invalid status' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;

  INSERT INTO guardians (
    id, tenant_id, display_name, phone, email, status, created_at, updated_at
  ) VALUES (
    p_guardian_id,
    p_tenant_id,
    btrim(p_display_name),
    NULLIF(btrim(COALESCE(p_phone, '')), ''),
    NULLIF(lower(btrim(COALESCE(p_email, ''))), ''),
    p_status,
    now(),
    now()
  );

  RETURN QUERY
  SELECT g.id, g.tenant_id, g.display_name, g.phone, g.email, g.status,
         g.created_at, g.updated_at
  FROM guardians g WHERE g.id = p_guardian_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.update_guardian(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_guardian_id uuid,
  p_set_display_name boolean,
  p_display_name text,
  p_set_phone boolean,
  p_phone text,
  p_set_email boolean,
  p_email text,
  p_set_status boolean,
  p_status text
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  display_name text,
  phone text,
  email text,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_guardian_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM guardians g WHERE g.id = p_guardian_id AND g.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'guardian not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE guardians g SET
    display_name = CASE
      WHEN p_set_display_name THEN btrim(p_display_name)
      ELSE g.display_name
    END,
    phone = CASE
      WHEN p_set_phone THEN NULLIF(btrim(COALESCE(p_phone, '')), '')
      ELSE g.phone
    END,
    email = CASE
      WHEN p_set_email THEN NULLIF(lower(btrim(COALESCE(p_email, ''))), '')
      ELSE g.email
    END,
    status = CASE
      WHEN p_set_status THEN p_status
      ELSE g.status
    END,
    updated_at = now()
  WHERE g.id = p_guardian_id AND g.tenant_id = p_tenant_id;

  RETURN QUERY
  SELECT g.id, g.tenant_id, g.display_name, g.phone, g.email, g.status,
         g.created_at, g.updated_at
  FROM guardians g WHERE g.id = p_guardian_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.create_student_guardian_link(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_link_id uuid,
  p_student_id uuid,
  p_guardian_id uuid,
  p_relationship_type text,
  p_is_primary boolean
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  student_id uuid,
  guardian_id uuid,
  relationship_type text,
  is_primary boolean,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_link_id IS NULL
     OR p_student_id IS NULL OR p_guardian_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF p_relationship_type IS NULL
     OR p_relationship_type NOT IN ('mother', 'father', 'guardian', 'other') THEN
    RAISE EXCEPTION 'invalid relationship_type' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM students s WHERE s.id = p_student_id AND s.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'student not found' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM guardians g WHERE g.id = p_guardian_id AND g.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'guardian not found' USING ERRCODE = '22023';
  END IF;

  INSERT INTO student_guardians (
    id, tenant_id, student_id, guardian_id, relationship_type, is_primary, status,
    created_at, updated_at
  ) VALUES (
    p_link_id, p_tenant_id, p_student_id, p_guardian_id, p_relationship_type,
    COALESCE(p_is_primary, false), 'active', now(), now()
  );

  RETURN QUERY
  SELECT l.id, l.tenant_id, l.student_id, l.guardian_id, l.relationship_type,
         l.is_primary, l.status, l.created_at, l.updated_at
  FROM student_guardians l WHERE l.id = p_link_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.end_student_guardian_link(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_guardian_id uuid,
  p_link_id uuid
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  student_id uuid,
  guardian_id uuid,
  relationship_type text,
  is_primary boolean,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL
     OR p_guardian_id IS NULL OR p_link_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;

  UPDATE student_guardians l SET
    status = 'ended',
    updated_at = now()
  WHERE l.id = p_link_id
    AND l.tenant_id = p_tenant_id
    AND l.guardian_id = p_guardian_id
    AND l.status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'link not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY
  SELECT l.id, l.tenant_id, l.student_id, l.guardian_id, l.relationship_type,
         l.is_primary, l.status, l.created_at, l.updated_at
  FROM student_guardians l WHERE l.id = p_link_id;
END;
$$;

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT EXECUTE ON FUNCTION app.create_guardian(uuid, uuid, uuid, text, text, text, text)
      TO educore_app;
    GRANT EXECUTE ON FUNCTION app.update_guardian(
      uuid, uuid, uuid, boolean, text, boolean, text, boolean, text, boolean, text
    ) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.create_student_guardian_link(
      uuid, uuid, uuid, uuid, uuid, text, boolean
    ) TO educore_app;
    GRANT EXECUTE ON FUNCTION app.end_student_guardian_link(uuid, uuid, uuid, uuid)
      TO educore_app;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION app.create_guardian(uuid, uuid, uuid, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.update_guardian(
  uuid, uuid, uuid, boolean, text, boolean, text, boolean, text, boolean, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.create_student_guardian_link(
  uuid, uuid, uuid, uuid, uuid, text, boolean
) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.end_student_guardian_link(uuid, uuid, uuid, uuid) FROM PUBLIC;
