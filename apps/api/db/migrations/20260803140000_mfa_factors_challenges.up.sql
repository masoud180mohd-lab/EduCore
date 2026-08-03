-- MFA-002: mfa_factors + mfa_challenges (DBF-001 / MFA-001 TOTP).

CREATE TABLE mfa_factors (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id),
  factor_type text NOT NULL,
  status text NOT NULL,
  secret_encrypted text NULL,
  label text NULL,
  confirmed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_mfa_factors_type CHECK (factor_type IN ('totp', 'webauthn', 'sms_otp')),
  CONSTRAINT ck_mfa_factors_status CHECK (status IN ('pending', 'active', 'disabled'))
);

COMMENT ON TABLE mfa_factors IS
  'Identity: MFA methods (DBF-001). TOTP secrets encrypted at app layer; never log.';

CREATE UNIQUE INDEX uq_mfa_factors_user_active_totp
  ON mfa_factors (user_id)
  WHERE factor_type = 'totp' AND status = 'active';

CREATE INDEX ix_mfa_factors_user_status ON mfa_factors (user_id, status);

CREATE TABLE mfa_challenges (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id),
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  challenge_token_hash text NOT NULL,
  status text NOT NULL,
  ip inet NULL,
  user_agent text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz NULL,
  CONSTRAINT uq_mfa_challenges_token UNIQUE (challenge_token_hash),
  CONSTRAINT ck_mfa_challenges_status CHECK (status IN ('pending', 'consumed', 'expired'))
);

COMMENT ON TABLE mfa_challenges IS
  'Short-lived opaque MFA login challenges (hash only).';

CREATE INDEX ix_mfa_challenges_user_status ON mfa_challenges (user_id, status);
CREATE INDEX ix_mfa_challenges_expires ON mfa_challenges (expires_at);

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT SELECT ON TABLE mfa_factors TO educore_app;
    REVOKE INSERT, UPDATE, DELETE ON TABLE mfa_factors FROM educore_app;
    GRANT SELECT ON TABLE mfa_challenges TO educore_app;
    REVOKE INSERT, UPDATE, DELETE ON TABLE mfa_challenges FROM educore_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_platform') THEN
    GRANT SELECT ON TABLE mfa_factors TO educore_platform;
    REVOKE INSERT, UPDATE, DELETE ON TABLE mfa_factors FROM educore_platform;
    GRANT SELECT ON TABLE mfa_challenges TO educore_platform;
    REVOKE INSERT, UPDATE, DELETE ON TABLE mfa_challenges FROM educore_platform;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_migrator') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE mfa_factors TO educore_migrator;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE mfa_challenges TO educore_migrator;
  END IF;
END
$$;

REVOKE ALL ON TABLE mfa_factors FROM PUBLIC;
REVOKE ALL ON TABLE mfa_challenges FROM PUBLIC;

ALTER TABLE mfa_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_factors FORCE ROW LEVEL SECURITY;
ALTER TABLE mfa_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_challenges FORCE ROW LEVEL SECURITY;

CREATE POLICY rls_mfa_factors_select ON mfa_factors
  FOR SELECT TO educore_app
  USING (user_id = app.current_user_id());

CREATE POLICY rls_mfa_factors_select_platform ON mfa_factors
  FOR SELECT TO educore_platform
  USING (app.is_trusted_platform_session());

CREATE POLICY rls_mfa_challenges_select ON mfa_challenges
  FOR SELECT TO educore_app
  USING (user_id = app.current_user_id());

CREATE POLICY rls_mfa_challenges_select_platform ON mfa_challenges
  FOR SELECT TO educore_platform
  USING (app.is_trusted_platform_session());

-- Privileged MFA signal for a user in a tenant (login / me; no GUC required).
CREATE OR REPLACE FUNCTION app.auth_user_has_privileged_mfa_perm(
  p_user_id uuid,
  p_tenant_id uuid
)
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
  IF NOT EXISTS (
    SELECT 1 FROM tenant_memberships m
    WHERE m.user_id = p_user_id AND m.tenant_id = p_tenant_id AND m.status = 'active'
  ) THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM user_roles ur
    INNER JOIN roles r ON r.id = ur.role_id AND r.tenant_id = ur.tenant_id
    INNER JOIN role_permissions rp ON rp.role_id = r.id
    INNER JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = p_user_id
      AND ur.tenant_id = p_tenant_id
      AND p.code IN ('finance.manage', 'tenant.manage', 'role.manage')
  );
END;
$$;

CREATE OR REPLACE FUNCTION app.auth_user_has_active_totp(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, app
AS $$
  SELECT EXISTS (
    SELECT 1 FROM mfa_factors f
    WHERE f.user_id = p_user_id
      AND f.factor_type = 'totp'
      AND f.status = 'active'
  );
$$;

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

  -- Collapse pending enrollments for this user.
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

CREATE OR REPLACE FUNCTION app.mfa_get_active_totp_secret(
  p_user_id uuid
)
RETURNS TABLE (
  factor_id uuid,
  secret_encrypted text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, app
AS $$
  SELECT f.id, f.secret_encrypted
  FROM mfa_factors f
  WHERE f.user_id = p_user_id
    AND f.factor_type = 'totp'
    AND f.status = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION app.mfa_get_pending_totp_secret(
  p_user_id uuid,
  p_factor_id uuid
)
RETURNS TABLE (
  factor_id uuid,
  secret_encrypted text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, app
AS $$
  SELECT f.id, f.secret_encrypted
  FROM mfa_factors f
  WHERE f.id = p_factor_id
    AND f.user_id = p_user_id
    AND f.factor_type = 'totp'
    AND f.status = 'pending'
  LIMIT 1;
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

CREATE OR REPLACE FUNCTION app.mfa_consume_challenge(
  p_challenge_token_hash text
)
RETURNS TABLE (
  challenge_id uuid,
  user_id uuid,
  tenant_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  v_row mfa_challenges%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM mfa_challenges c
  WHERE c.challenge_token_hash = p_challenge_token_hash
    AND c.status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'challenge not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_row.expires_at <= now() THEN
    UPDATE mfa_challenges SET status = 'expired' WHERE id = v_row.id;
    RAISE EXCEPTION 'challenge expired' USING ERRCODE = 'P0001';
  END IF;

  UPDATE mfa_challenges
  SET status = 'consumed', consumed_at = now()
  WHERE id = v_row.id;

  RETURN QUERY SELECT v_row.id, v_row.user_id, v_row.tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION app.auth_user_has_privileged_mfa_perm(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.auth_user_has_active_totp(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.mfa_begin_totp_enrollment(uuid, uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.mfa_confirm_totp_factor(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.mfa_disable_factor(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.mfa_get_active_totp_secret(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.mfa_get_pending_totp_secret(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.mfa_create_challenge(uuid, uuid, uuid, text, timestamptz, inet, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.mfa_consume_challenge(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION app.auth_user_has_privileged_mfa_perm(uuid, uuid) TO educore_app;
GRANT EXECUTE ON FUNCTION app.auth_user_has_active_totp(uuid) TO educore_app;
GRANT EXECUTE ON FUNCTION app.mfa_begin_totp_enrollment(uuid, uuid, text, text, text) TO educore_app;
GRANT EXECUTE ON FUNCTION app.mfa_confirm_totp_factor(uuid, uuid) TO educore_app;
GRANT EXECUTE ON FUNCTION app.mfa_disable_factor(uuid, uuid) TO educore_app;
GRANT EXECUTE ON FUNCTION app.mfa_get_active_totp_secret(uuid) TO educore_app;
GRANT EXECUTE ON FUNCTION app.mfa_get_pending_totp_secret(uuid, uuid) TO educore_app;
GRANT EXECUTE ON FUNCTION app.mfa_create_challenge(uuid, uuid, uuid, text, timestamptz, inet, text) TO educore_app;
GRANT EXECUTE ON FUNCTION app.mfa_consume_challenge(text) TO educore_app;
