-- MFA-002 down.

DROP FUNCTION IF EXISTS app.mfa_consume_challenge(text);
DROP FUNCTION IF EXISTS app.mfa_create_challenge(uuid, uuid, uuid, text, timestamptz, inet, text);
DROP FUNCTION IF EXISTS app.mfa_get_pending_totp_secret(uuid, uuid);
DROP FUNCTION IF EXISTS app.mfa_get_active_totp_secret(uuid);
DROP FUNCTION IF EXISTS app.mfa_disable_factor(uuid, uuid);
DROP FUNCTION IF EXISTS app.mfa_confirm_totp_factor(uuid, uuid);
DROP FUNCTION IF EXISTS app.mfa_begin_totp_enrollment(uuid, uuid, text, text, text);
DROP FUNCTION IF EXISTS app.auth_user_has_active_totp(uuid);
DROP FUNCTION IF EXISTS app.auth_user_has_privileged_mfa_perm(uuid, uuid);

DROP TABLE IF EXISTS mfa_challenges;
DROP TABLE IF EXISTS mfa_factors;
