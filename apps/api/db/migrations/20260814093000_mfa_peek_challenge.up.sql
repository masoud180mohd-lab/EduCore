-- MFA login: look up a pending challenge without consuming it.
-- Wrong TOTP must not burn the challenge (retries within TTL).

CREATE OR REPLACE FUNCTION app.mfa_get_pending_challenge(
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
  FROM mfa_challenges AS c
  WHERE c.challenge_token_hash = p_challenge_token_hash
    AND c.status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'challenge not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_row.expires_at <= now() THEN
    UPDATE mfa_challenges AS c
    SET status = 'expired'
    WHERE c.id = v_row.id;
    RAISE EXCEPTION 'challenge expired' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY SELECT v_row.id, v_row.user_id, v_row.tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION app.mfa_get_pending_challenge(text) FROM PUBLIC;

DO
$$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore_app') THEN
    GRANT EXECUTE ON FUNCTION app.mfa_get_pending_challenge(text) TO educore_app;
  END IF;
END
$$;
