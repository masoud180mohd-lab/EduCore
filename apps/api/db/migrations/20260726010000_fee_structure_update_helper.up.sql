-- IMP-024: Partial fee structure update with optional full item replacement.
-- Direct table writes remain unavailable to educore_app; mutation is through
-- this tenant-scoped SECURITY DEFINER helper only.

CREATE OR REPLACE FUNCTION app.update_fee_structure(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_structure_id uuid,
  p_set_name boolean,
  p_name text,
  p_set_status boolean,
  p_status text,
  p_set_items boolean,
  p_items jsonb
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  academic_year_id uuid,
  name text,
  status text,
  currency text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  r jsonb;
  v_item_id uuid;
  v_item_name text;
  v_amount_minor bigint;
  v_sort_order int;
BEGIN
  IF p_actor_user_id IS NULL OR p_tenant_id IS NULL OR p_structure_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;
  IF NOT COALESCE(p_set_name, false)
     AND NOT COALESCE(p_set_status, false)
     AND NOT COALESCE(p_set_items, false) THEN
    RAISE EXCEPTION 'no fields to update' USING ERRCODE = '22023';
  END IF;
  IF p_set_name
     AND (p_name IS NULL OR char_length(btrim(p_name)) < 1 OR char_length(btrim(p_name)) > 200) THEN
    RAISE EXCEPTION 'invalid name' USING ERRCODE = '22023';
  END IF;
  IF p_set_status AND (p_status IS NULL OR p_status NOT IN ('draft', 'active', 'archived')) THEN
    RAISE EXCEPTION 'invalid status' USING ERRCODE = '22023';
  END IF;
  IF p_set_items
     AND (p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) < 1) THEN
    RAISE EXCEPTION 'invalid items' USING ERRCODE = '22023';
  END IF;
  IF NOT app.auth_has_active_membership(p_actor_user_id, p_tenant_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM fee_structures fs
    WHERE fs.id = p_structure_id AND fs.tenant_id = p_tenant_id
  ) THEN
    RETURN;
  END IF;

  IF p_set_items THEN
    IF EXISTS (
      SELECT 1
      FROM invoice_lines il
      JOIN fee_structure_items fsi
        ON fsi.id = il.fee_structure_item_id
       AND fsi.tenant_id = il.tenant_id
      WHERE fsi.fee_structure_id = p_structure_id
        AND fsi.tenant_id = p_tenant_id
    ) THEN
      RAISE EXCEPTION 'fee structure items are in use by invoices'
        USING ERRCODE = 'P0001';
    END IF;

    DELETE FROM fee_structure_items fsi
    WHERE fsi.fee_structure_id = p_structure_id AND fsi.tenant_id = p_tenant_id;

    FOR r IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_item_id := (r->>'id')::uuid;
      v_item_name := btrim(COALESCE(r->>'name', ''));
      v_amount_minor := (r->>'amountMinor')::bigint;
      v_sort_order := COALESCE((r->>'sortOrder')::int, 0);

      IF v_item_id IS NULL THEN
        RAISE EXCEPTION 'invalid item id' USING ERRCODE = '22023';
      END IF;
      IF char_length(v_item_name) < 1 OR char_length(v_item_name) > 200 THEN
        RAISE EXCEPTION 'invalid item name' USING ERRCODE = '22023';
      END IF;
      IF v_amount_minor IS NULL OR v_amount_minor <= 0 THEN
        RAISE EXCEPTION 'invalid item amountMinor' USING ERRCODE = '22023';
      END IF;

      INSERT INTO fee_structure_items (
        id, tenant_id, fee_structure_id, name, amount_minor, sort_order, created_at
      ) VALUES (
        v_item_id, p_tenant_id, p_structure_id, v_item_name, v_amount_minor, v_sort_order, now()
      );
    END LOOP;
  END IF;

  UPDATE fee_structures fs
  SET
    name = CASE WHEN p_set_name THEN btrim(p_name) ELSE fs.name END,
    status = CASE WHEN p_set_status THEN p_status ELSE fs.status END,
    updated_at = now()
  WHERE fs.id = p_structure_id AND fs.tenant_id = p_tenant_id;

  RETURN QUERY
  SELECT fs.id, fs.tenant_id, fs.academic_year_id, fs.name, fs.status, fs.currency,
         fs.created_at, fs.updated_at
  FROM fee_structures fs
  WHERE fs.id = p_structure_id AND fs.tenant_id = p_tenant_id;
END;
$$;

COMMENT ON FUNCTION app.update_fee_structure(
  uuid, uuid, uuid, boolean, text, boolean, text, boolean, jsonb
) IS 'IMP-024: Partial fee structure update; item changes are full replacement. Empty if missing.';

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT EXECUTE ON FUNCTION app.update_fee_structure(
      uuid, uuid, uuid, boolean, text, boolean, text, boolean, jsonb
    ) TO educore_app;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION app.update_fee_structure(
  uuid, uuid, uuid, boolean, text, boolean, text, boolean, jsonb
) FROM PUBLIC;
