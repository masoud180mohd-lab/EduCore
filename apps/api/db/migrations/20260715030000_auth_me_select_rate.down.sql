DROP FUNCTION IF EXISTS app.auth_rate_limit_reset(text);
DROP FUNCTION IF EXISTS app.auth_rate_limit_record_failure(text, integer, integer);
DROP FUNCTION IF EXISTS app.auth_rate_limit_status(text, integer, integer);
DROP TABLE IF EXISTS app.login_rate_limits;
DROP FUNCTION IF EXISTS app.auth_rebind_session_tenant(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS app.auth_list_membership_summaries(uuid);
DROP FUNCTION IF EXISTS app.auth_get_user_profile(uuid);
