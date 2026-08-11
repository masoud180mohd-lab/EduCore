-- Reverse MFA helper ambiguity fix (restore-create from MFA-002 originals).

CREATE OR REPLACE FUNCTION app.mfa_begin_totp_enrollment(
  p_user_id uuid,
  p_factor_id uuid,
  p_secret_encrypted text,
  p_label text,
  p_idempotency_key text
)
RETURNS TABLE (
  id uuid,
  factor_type text,
  status text,
  label text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  v_existing uuid;
BEGIN
  IF p_user_id IS NULL OR p_factor_id IS NULL OR p_secret_encrypted IS NULL
     OR btrim(p_secret_encrypted) = '' OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM mfa_factors f
    WHERE f.user_id = p_user_id AND f.factor_type = 'totp' AND f.status = 'active'
  ) THEN
    RAISE EXCEPTION 'active totp already exists' USING ERRCODE = '23505';
  END IF;

  UPDATE mfa_factors
  SET status = 'disabled', updated_at = now()
  WHERE user_id = p_user_id AND factor_type = 'totp' AND status = 'pending';

  INSERT INTO mfa_factors (
    id, user_id, factor_type, status, secret_encrypted, label, created_at, updated_at
  ) VALUES (
    p_factor_id, p_user_id, 'totp', 'pending', btrim(p_secret_encrypted),
    NULLIF(btrim(COALESCE(p_label, '')), ''), now(), now()
  );

  RETURN QUERY
  SELECT f.id, f.factor_type, f.status, f.label, f.created_at
  FROM mfa_factors f WHERE f.id = p_factor_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.mfa_confirm_totp_factor(
  p_user_id uuid,
  p_factor_id uuid
)
RETURNS TABLE (
  id uuid,
  factor_type text,
  status text,
  label text,
  confirmed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
  IF p_user_id IS NULL OR p_factor_id IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;

  UPDATE mfa_factors f
  SET status = 'active',
      confirmed_at = now(),
      updated_at = now()
  WHERE f.id = p_factor_id
    AND f.user_id = p_user_id
    AND f.factor_type = 'totp'
    AND f.status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'factor not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY
  SELECT f.id, f.factor_type, f.status, f.label, f.confirmed_at, f.created_at, f.updated_at
  FROM mfa_factors f WHERE f.id = p_factor_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.mfa_disable_factor(
  p_user_id uuid,
  p_factor_id uuid
)
RETURNS TABLE (
  id uuid,
  factor_type text,
  status text,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
  UPDATE mfa_factors f
  SET status = 'disabled',
      secret_encrypted = NULL,
      updated_at = now()
  WHERE f.id = p_factor_id
    AND f.user_id = p_user_id
    AND f.status IN ('pending', 'active');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'factor not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY
  SELECT f.id, f.factor_type, f.status, f.updated_at
  FROM mfa_factors f WHERE f.id = p_factor_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.mfa_create_challenge(
  p_challenge_id uuid,
  p_user_id uuid,
  p_tenant_id uuid,
  p_challenge_token_hash text,
  p_expires_at timestamptz,
  p_ip inet,
  p_user_agent text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
BEGIN
  IF p_challenge_id IS NULL OR p_user_id IS NULL OR p_tenant_id IS NULL
     OR p_challenge_token_hash IS NULL OR p_expires_at IS NULL THEN
    RAISE EXCEPTION 'invalid parameters' USING ERRCODE = '22023';
  END IF;

  UPDATE mfa_challenges
  SET status = 'expired'
  WHERE user_id = p_user_id AND status = 'pending';

  INSERT INTO mfa_challenges (
    id, user_id, tenant_id, challenge_token_hash, status, ip, user_agent, created_at, expires_at
  ) VALUES (
    p_challenge_id, p_user_id, p_tenant_id, p_challenge_token_hash, 'pending',
    p_ip, NULLIF(btrim(COALESCE(p_user_agent, '')), ''), now(), p_expires_at
  );
END;
$$;
